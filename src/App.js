// App.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getUserData, saveUserData, getProfile, getAccountId, getAllUsersData, getAllPublicEntries, toggleLike, hasUserLiked, getLikeCount } from "./utils/storage";
import { getTodayDate, isSameDay, buildBirthdayISO } from "./utils/dateHelpers";
import { encodeSentence } from "./utils/cipher";
import { pollinationsFetch, extractZodiac, normalizeSentence, isConcise } from "./utils/ai";
import { processImageFile } from "./utils/imageHelpers";
import { signOut, signIn, register, deleteAccount, updateProfile, resetPassword } from "./utils/authHelpers";
import { calculateStreak, calculateSolvePoints, calculateUploadPoints, hasCompletedToday, createDeed } from "./utils/deedHelpers";
import { MAX_SENTENCE_WORDS, zodiacInsights } from "./constants/zodiac";
import { CARD_MAX_WIDTH, FRAME_WIDTH, SAFE_PADDING } from "./constants/config";
import { useAdOffsets } from "./hooks/useAdOffsets";
import { monthOptions, useYearOptions, useDayOptions } from "./utils/dateOptions";
import { CardFrame } from "./components/CardFrame";
import { BirthdayInput } from "./components/BirthdayInput";
import { ImageUpload } from "./components/ImageUpload";
import { getTextColor, getCardBg, getCardBorder, getInputStyle } from "./utils/themeHelpers";
import {
  mainCardStyle,
  buttonStyle,
  inputStyle,
  selectStyle,
  selectLabelStyle,
  dateGridStyle,
  chipStyle,
  topBarStyle,
  navButtonStyle,
  footerStyle,
} from "./styles/theme";

function App() {
  const [profile, setProfile] = useState(getProfile());
  const [isSignedIn, setIsSignedIn] = useState(!!getProfile());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthday, setBirthday] = useState("");
  const [birthdayParts, setBirthdayParts] = useState({
    month: "",
    day: "",
    year: "",
  });
  const [step, setStep] = useState(1);
  const [encodedSentence, setEncodedSentence] = useState("");
  const [goodDeed, setGoodDeed] = useState("");
  const [userInput, setUserInput] = useState("");
  const [message, setMessage] = useState("");
  const [shift, setShift] = useState(0);
  const [decodeShift, setDecodeShift] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("home");
  const accountId = useMemo(() => getAccountId(profile), [profile]);
  const [userData, setUserData] = useState(() => getUserData(getAccountId(profile)));
  const [deedCompleted, setDeedCompleted] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [pendingDeed, setPendingDeed] = useState(null);
  const [editingDeedIndex, setEditingDeedIndex] = useState(null);
  const hasRestoredPendingDeed = useRef(false);
  const [theme, setTheme] = useState(() => {
    const savedProfile = getProfile();
    return savedProfile?.theme || "dark";
  });
  const [username, setUsername] = useState(() => {
    const savedProfile = getProfile();
    return savedProfile?.username || "";
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);
  const [editingBirthday, setEditingBirthday] = useState(false);
  const [settingsBirthdayParts, setSettingsBirthdayParts] = useState(() => {
    const savedProfile = getProfile();
    if (savedProfile?.birthday) {
      const date = new Date(savedProfile.birthday);
      return {
        month: String(date.getMonth() + 1).padStart(2, '0'),
        day: String(date.getDate()).padStart(2, '0'),
        year: String(date.getFullYear()),
      };
    }
    return { month: "", day: "", year: "" };
  });
  const [communitySort, setCommunitySort] = useState("latest"); // "latest" or "popular"
  const [likesUpdate, setLikesUpdate] = useState(0); // Force re-render when likes change
  const [menuOpen, setMenuOpen] = useState(false); // Burger menu state
  const [leaderboardSearch, setLeaderboardSearch] = useState(""); // Leaderboard search query
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [menuOpen]);

  const adOffsets = useAdOffsets();
  const yearOptions = useYearOptions();
  const dayOptions = useDayOptions(birthdayParts);
  const settingsDayOptions = useDayOptions(settingsBirthdayParts);

  const updateBirthdayParts = useCallback((field, value) => {
    setBirthdayParts((prev) => {
      const next = { ...prev, [field]: value };
      if ((field === "month" || field === "year") && next.day) {
        const maxDay = new Date(
          Number(next.year || new Date().getFullYear()),
          Number(next.month || 1),
          0
        ).getDate();
        if (Number(next.day) > maxDay) {
          next.day = String(maxDay).padStart(2, "0");
        }
      }
      const iso = buildBirthdayISO(next);
      setBirthday(iso);
      return next;
    });
  }, []);

  const handleEmailChange = useCallback((e) => {
    setEmail(e.target.value);
  }, []);

  const handleUserInputChange = useCallback((e) => {
    setUserInput(e.target.value);
  }, []);

  const handlePasswordChange = useCallback((e) => {
    setPassword(e.target.value);
  }, []);

  const handleImageChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imageDataUrl = await processImageFile(file);
      
      // If there's already an image preview, user is changing the image
      // Subtract upload points immediately if they were awarded
      if (imagePreview && pendingDeed) {
        const currentAccountId = getAccountId(profile);
        const currentUserData = getUserData(currentAccountId);
        const today = getTodayDate();
        const todayDeedIndex = currentUserData.pastDeeds.findIndex(d => d.date === today);
        
        if (todayDeedIndex !== -1) {
          const existingDeed = currentUserData.pastDeeds[todayDeedIndex];
          
          // If this deed has upload points, remove them immediately
          if (existingDeed.uploadPoints && existingDeed.uploadPoints > 0) {
            const pointsToRemove = existingDeed.uploadPoints;
            const updatedDeeds = [...currentUserData.pastDeeds];
            updatedDeeds[todayDeedIndex] = {
              ...existingDeed,
              uploadPoints: 0,
              totalPoints: (existingDeed.solvePoints || 0),
            };
            
            const updatedData = {
              ...currentUserData,
              points: Math.max(0, currentUserData.points - pointsToRemove),
              pastDeeds: updatedDeeds,
            };
            
            setUserData(updatedData);
            saveUserData(currentAccountId, updatedData);
            setMessage(`⚠️ Photo changed. Upload points (${pointsToRemove}) removed. Submit new photo to earn them back!`);
          }
        }
      }
      
      setImageFile(file);
      setImagePreview(imageDataUrl);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [imagePreview, pendingDeed, profile]);


  const handleSignOut = useCallback(() => {
    const resetState = signOut();
    setProfile(resetState.profile);
    setIsSignedIn(resetState.isSignedIn);
    setEmail(resetState.email);
    setBirthday(resetState.birthday);
    setBirthdayParts(resetState.birthdayParts);
    setStep(resetState.step);
    setView(resetState.view);
    setMessage(""); // Clear any completion messages
    setError(""); // Clear any error messages
    setDeedCompleted(false);
    setShowImageUpload(false);
    setImagePreview(null);
    setImageFile(null);
    setPendingDeed(null);
    setEncodedSentence(""); // Clear encoded sentence
    setGoodDeed(""); // Clear good deed
    setUserInput(""); // Clear user input
    setUserData({ points: 0, streak: 0, lastDeedDate: null, pastDeeds: [] });
  }, []);

  const handleSignInClick = useCallback(() => {
    setView("home");
    setStep(0.5); // Sign-in step
    setEmail("");
    setBirthdayParts({ month: "", day: "", year: "" });
    setError("");
  }, []);

  const handleSignIn = useCallback(() => {
    try {
      const signedInProfile = signIn(email, password);
      setProfile(signedInProfile);
      setIsSignedIn(true);
      setBirthday(signedInProfile.birthday);
      setPassword("");
      setError("");
      // Update theme and username from profile
      setTheme(signedInProfile.theme || "dark");
      setUsername(signedInProfile.username || signedInProfile.email.split("@")[0]);
      // Update settings birthday parts
      if (signedInProfile.birthday) {
        const date = new Date(signedInProfile.birthday);
        setSettingsBirthdayParts({
          month: String(date.getMonth() + 1).padStart(2, '0'),
          day: String(date.getDate()).padStart(2, '0'),
          year: String(date.getFullYear()),
        });
      } else {
        setSettingsBirthdayParts({ month: "", day: "", year: "" });
      }
      // Reload user data for the signed-in account
      const accountData = getUserData(signedInProfile.email);
      setUserData(accountData);
      // Will auto-run prompt via useEffect
    } catch (err) {
      setError(err.message);
    }
  }, [email, password]);

  const runPrompt = async (isoBirthday) => {
    if (!isoBirthday) return;
    
    // Prevent multiple simultaneous prompts - if already loading or already have a puzzle, don't run
    if (loading || encodedSentence || goodDeed) {
      return;
    }

    // Check daily limit
    const today = getTodayDate();
    if (isSameDay(userData.lastDeedDate, today) && userData.pastDeeds.some(d => d.date === today)) {
      setError("You've already completed today's good deed! Come back tomorrow for a new challenge.");
      return;
    }

    setBirthday(isoBirthday);
    try {
      setLoading(true);
      setError("");

      const zodiacPrompt = `Given the birthday ${isoBirthday}, which zodiac sign does it correspond to? Answer with only the zodiac sign.`;
      const zodiacResponse = await pollinationsFetch(zodiacPrompt);
      const zodiacSign = extractZodiac(zodiacResponse);

      if (!zodiacSign) {
        throw new Error("Could not determine zodiac sign.");
      }

      const deedPrompt = `Respond with exactly one clear sentence (less than or equal to ${MAX_SENTENCE_WORDS} words) giving the user a task as a good deed to help someone or do an action that aligns that with the nature of someone whose zodiac sign is ${zodiacSign}. Do not add extra commentary.`;
      const deedResponse = await pollinationsFetch(deedPrompt);
      const sentence = normalizeSentence(deedResponse);

      if (!sentence || sentence.length < 5) {
        throw new Error("AI returned an invalid sentence.");
      }

      if (!isConcise(sentence, MAX_SENTENCE_WORDS)) {
        throw new Error("AI returned a sentence that was not concise enough.");
      }

    const { encoded, shift } = encodeSentence(sentence);
    setGoodDeed(sentence);
    setEncodedSentence(encoded);
    setShift(shift);
      setDecodeShift((26 - shift) % 26 || 26);
    setUserInput("");
    setMessage("");
    setStep(2);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Load user data when profile/account changes (separate effect to avoid loops)
  useEffect(() => {
    const currentAccountId = getAccountId(profile);
    const currentUserData = getUserData(currentAccountId);
    setUserData(currentUserData);
    // Update theme and username from profile
    if (profile) {
      setTheme(profile.theme || "dark");
      setUsername(profile.username || profile.email?.split("@")[0] || "");
    }
  }, [profile, isSignedIn]);

  // Handle pending deed restoration (separate effect)
  useEffect(() => {
    const currentAccountId = getAccountId(profile);
    const currentUserData = getUserData(currentAccountId);
    
    // Check if there's a pending deed (today's deed without upload points)
    // Only restore if we don't already have a puzzle active (prevents infinite loops)
    if (isSignedIn && !encodedSentence && !goodDeed && !loading && step === 2 && view === "home" && !hasRestoredPendingDeed.current) {
      const today = getTodayDate();
      const todayDeed = currentUserData.pastDeeds.find(d => d.date === today);
      if (todayDeed && (!todayDeed.uploadPoints || todayDeed.uploadPoints === 0)) {
        // Only restore if we don't already have this set (prevents loops)
        if (!pendingDeed || pendingDeed.date !== today) {
          setPendingDeed({
            deed: todayDeed.deed,
            solvePoints: todayDeed.solvePoints || 0,
            streak: todayDeed.streak || 0,
            date: todayDeed.date,
          });
        }
        if (!showImageUpload) {
          setShowImageUpload(true);
        }
        // Restore encoded sentence and good deed if available
        if (todayDeed.deed && todayDeed.deed !== goodDeed) {
          setGoodDeed(todayDeed.deed);
          // Re-encode if we have the original
          const encoded = encodeSentence(todayDeed.deed);
          setEncodedSentence(encoded.encoded);
          setShift(encoded.shift);
          setDecodeShift(26 - encoded.shift);
        }
        hasRestoredPendingDeed.current = true;
      } else if (todayDeed && todayDeed.uploadPoints && todayDeed.uploadPoints > 0) {
        // If photo is already uploaded, clear pending deed state
        if (pendingDeed) {
          setPendingDeed(null);
        }
        if (showImageUpload) {
          setShowImageUpload(false);
        }
        hasRestoredPendingDeed.current = true;
      }
    }
    
    // Reset the ref when profile or step changes significantly
    if (step !== 2 || view !== "home" || !isSignedIn) {
      hasRestoredPendingDeed.current = false;
    }
  }, [profile, step, view, isSignedIn, loading]);

  useEffect(() => {
    // Auto-run prompt when signed in (for existing users or after registration)
    // Only run once when conditions are met, not repeatedly
    if (isSignedIn && profile && profile.birthday && !loading && (step === 0.5 || step === 1)) {
      // Check if we already have a puzzle to avoid re-running
      if (!encodedSentence && !goodDeed) {
        runPrompt(profile.birthday);
      }
    }
  }, [isSignedIn, profile, step, loading, encodedSentence, goodDeed]);

  useEffect(() => {
    if (!isSignedIn || !profile) return;
    
    const today = getTodayDate();
    const currentAccountId = getAccountId(profile);
    const currentUserData = getUserData(currentAccountId);
    if (isSameDay(currentUserData.lastDeedDate, today) && currentUserData.pastDeeds.some(d => d.date === today)) {
      setDeedCompleted(true);
      if (step === 2) {
        setMessage("✅ You've already completed today's good deed! Come back tomorrow.");
      }
    } else {
      setDeedCompleted(false);
      if (step === 2 && message.includes("already completed")) {
        setMessage("");
      }
    }
  }, [profile, step, isSignedIn, message, error]);

  const handleProfileSubmit = () => {
    try {
      const isoBirthday = buildBirthdayISO(birthdayParts);
      const newProfile = register(email, password, isoBirthday);
      setProfile(newProfile);
      setIsSignedIn(true);
      setBirthday(isoBirthday);
      setPassword("");
      setError("");
      // Update theme and username from new profile
      setTheme(newProfile.theme || "dark");
      setUsername(newProfile.username || newProfile.email.split("@")[0]);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUsernameUpdate = useCallback(() => {
    if (!isSignedIn || !profile) return;
    if (!username || username.trim().length === 0) {
      setError("Username cannot be empty.");
      return;
    }
    try {
      const updatedProfile = updateProfile(profile.email, { username: username.trim() });
      setProfile(updatedProfile);
      setEditingUsername(false);
      setError("");
      setMessage("Username updated successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError(err.message);
    }
  }, [username, isSignedIn, profile]);

  const handleBirthdayUpdate = useCallback(() => {
    if (!isSignedIn || !profile) return;
    try {
      const isoBirthday = buildBirthdayISO(settingsBirthdayParts);
      if (!isoBirthday) {
        setError("Please select a valid birthday.");
        return;
      }
      const updatedProfile = updateProfile(profile.email, { birthday: isoBirthday });
      setProfile(updatedProfile);
      setBirthday(isoBirthday);
      setEditingBirthday(false);
      setError("");
      setMessage("Birthday updated successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError(err.message);
    }
  }, [settingsBirthdayParts, isSignedIn, profile]);

  const updateSettingsBirthdayParts = useCallback((field, value) => {
    setSettingsBirthdayParts((prev) => {
      const updated = { ...prev, [field]: value };
      return updated;
    });
  }, []);

  const handleThemeToggle = useCallback(() => {
    if (!isSignedIn || !profile) return;
    const newTheme = theme === "dark" ? "light" : "dark";
    try {
      const updatedProfile = updateProfile(profile.email, { theme: newTheme });
      setProfile(updatedProfile);
      setTheme(newTheme);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [theme, isSignedIn, profile]);

  const handlePasswordReset = useCallback(() => {
    if (!isSignedIn || !profile) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all password fields.");
      return;
    }
    try {
      const updatedProfile = resetPassword(profile.email, currentPassword, newPassword, confirmPassword);
      setProfile(updatedProfile);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
      setMessage("Password updated successfully!");
      setTimeout(() => setMessage(""), 5000);
    } catch (err) {
      setError(err.message);
    }
  }, [currentPassword, newPassword, confirmPassword, isSignedIn, profile]);

  const handleDeleteAccount = useCallback(() => {
    if (!isSignedIn || !profile) return;
    if (!window.confirm("Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently removed.")) {
      return;
    }
    try {
      deleteAccount(profile.email);
      // Sign out after deletion
      const resetState = signOut();
      setProfile(resetState.profile);
      setIsSignedIn(resetState.isSignedIn);
      setEmail(resetState.email);
      setBirthday(resetState.birthday);
      setBirthdayParts(resetState.birthdayParts);
      setStep(resetState.step);
      setView(resetState.view);
      setMessage("");
      setDeedCompleted(false);
      setUsername("");
      setTheme("dark");
      setUserData({ points: 0, streak: 0, lastDeedDate: null, pastDeeds: [] });
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [isSignedIn, profile]);

  const handleBirthdaySubmit = async (providedBirthday = null) => {
    if (!isSignedIn || !profile) {
      setError("Please sign in to continue.");
      return;
    }
    
    const isoBirthday = providedBirthday || buildBirthdayISO(birthdayParts);
    
    // Check if isoBirthday is valid
    if (!isoBirthday || String(isoBirthday).trim() === "") {
      setError("Please select a complete birthday.");
      return;
    }
    
    // Convert to string if it's not already (handles edge cases)
    const isoBirthdayStr = String(isoBirthday).trim();
    
    // Prevent running if already loading or have a puzzle
    if (loading || encodedSentence || goodDeed) {
      return;
    }
    await runPrompt(isoBirthdayStr);
  };

  const checkAnswer = () => {
    if (userInput.trim().toLowerCase() !== goodDeed.toLowerCase()) {
      setMessage("❌ Incorrect, try again!");
      return;
    }

    const currentAccountId = getAccountId(profile);
    const currentUserData = getUserData(currentAccountId);
    
    // Only check if already completed when signed in
    if (isSignedIn && hasCompletedToday(currentUserData)) {
      setMessage("✅ You've already completed today's good deed! Come back tomorrow.");
      return;
    }

    const newStreak = calculateStreak(currentUserData.lastDeedDate, currentUserData.streak);
    const solvePoints = calculateSolvePoints(newStreak); // 5 + streak points for solving

    // Create deed immediately with solve points and go to journal
    const newDeed = createDeed(
      goodDeed,
      solvePoints,
      0, // No upload points yet
      newStreak,
      null // No image yet
    );

    const updatedData = {
      ...currentUserData,
      points: currentUserData.points + solvePoints,
      streak: newStreak,
      lastDeedDate: getTodayDate(),
      pastDeeds: [newDeed, ...currentUserData.pastDeeds].slice(0, 100),
    };

    setUserData(updatedData);
    saveUserData(currentAccountId, updatedData);
    setDeedCompleted(true);
    
    // Set pending deed so user can upload photo and get more points
    setPendingDeed({
      deed: goodDeed,
      solvePoints: solvePoints,
      streak: newStreak,
      date: getTodayDate(),
    });
    
    setMessage(`✅ Correct! +${solvePoints} points! Upload a photo to earn ${calculateUploadPoints(newStreak)} more points!`);
    
    // Show image upload option on experience page instead of navigating away
    setShowImageUpload(true);
  };

  const handleImageSubmit = () => {
    if (!imagePreview || !pendingDeed) {
      setError("Please upload an image to complete your good deed.");
      return;
    }

    const currentAccountId = getAccountId(profile);
    const currentUserData = getUserData(currentAccountId);
    const uploadPoints = calculateUploadPoints(pendingDeed.streak); // 5 + streak points for uploading

    // Find today's deed in pastDeeds and update it
    const today = getTodayDate();
    const updatedDeeds = [...currentUserData.pastDeeds];
    const todayDeedIndex = updatedDeeds.findIndex(d => d.date === today);
    
    if (todayDeedIndex !== -1) {
      // Check if upload points were already awarded
      const existingDeed = updatedDeeds[todayDeedIndex];
      const alreadyHasUploadPoints = existingDeed.uploadPoints && existingDeed.uploadPoints > 0;
      
      if (!alreadyHasUploadPoints) {
        // Update existing deed with image and upload points
        updatedDeeds[todayDeedIndex] = {
          ...updatedDeeds[todayDeedIndex],
          image: imagePreview,
          uploadPoints: uploadPoints,
          totalPoints: (existingDeed.solvePoints || pendingDeed.solvePoints) + uploadPoints,
        };
        
        // Add upload points to total
        const updatedData = {
          ...currentUserData,
          points: currentUserData.points + uploadPoints,
          streak: pendingDeed.streak,
          lastDeedDate: pendingDeed.date,
          pastDeeds: updatedDeeds.slice(0, 100),
        };

        setUserData(updatedData);
        saveUserData(currentAccountId, updatedData);
        
        setMessage(`✅ Photo uploaded! +${uploadPoints} more points! Total: ${(existingDeed.solvePoints || pendingDeed.solvePoints) + uploadPoints} points!`);
        
        // Clear pending deed since photo is now uploaded
        setPendingDeed(null);
        setShowImageUpload(false);
      } else {
        // Changing an existing photo - points were already removed in handleImageChange
        // Now add points back for the new image
        updatedDeeds[todayDeedIndex] = {
          ...updatedDeeds[todayDeedIndex],
          image: imagePreview,
          uploadPoints: uploadPoints, // Add points back for new image
          totalPoints: (existingDeed.solvePoints || pendingDeed.solvePoints) + uploadPoints,
        };
        
        // Add upload points back to total
        const updatedData = {
          ...currentUserData,
          points: currentUserData.points + uploadPoints,
          pastDeeds: updatedDeeds.slice(0, 100),
        };
        setUserData(updatedData);
        saveUserData(currentAccountId, updatedData);
        setMessage(`✅ Photo updated! +${uploadPoints} points added back! Total: ${(existingDeed.solvePoints || pendingDeed.solvePoints) + uploadPoints} points!`);
        
        // Clear pending deed since photo is now uploaded
        setPendingDeed(null);
        setShowImageUpload(false);
      }
    } else {
      // Create new deed if somehow it doesn't exist
      const newDeed = createDeed(
        pendingDeed.deed,
        pendingDeed.solvePoints,
        uploadPoints,
        pendingDeed.streak,
        imagePreview
      );
      const updatedData = {
        ...currentUserData,
        points: currentUserData.points + uploadPoints,
        streak: pendingDeed.streak,
        lastDeedDate: pendingDeed.date,
        pastDeeds: [newDeed, ...updatedDeeds].slice(0, 100),
      };
      setUserData(updatedData);
      saveUserData(currentAccountId, updatedData);
      
      setMessage(`✅ Deed completed! +${uploadPoints} more points! Total: ${pendingDeed.solvePoints + uploadPoints} points!`);
    }

    setDeedCompleted(true);
    setShowImageUpload(false);
    setImagePreview(null);
    setImageFile(null);
    setPendingDeed(null);
    
    // Navigate to journal after a short delay (only for signed-in users)
    if (isSignedIn) {
      setTimeout(() => {
        setView("journal");
        setMessage(""); // Clear message when navigating
      }, 2000);
    }
  };

  const availableWidth = useMemo(
    () => (typeof window !== "undefined" ? window.innerWidth - SAFE_PADDING * 2 : FRAME_WIDTH),
    []
  );

  const pageStyle = useMemo(
    () => ({
      minHeight: "100vh",
      margin: 0,
      fontFamily: "'Space Grotesk', Arial, sans-serif",
      color: theme === "dark" ? "#f7f8fb" : "#1a202c",
      background: theme === "dark" 
        ? "#1f2128" 
        : "linear-gradient(135deg, #f7fafc 0%, #edf2f7 50%, #e2e8f0 100%)",
      paddingTop: 120 + adOffsets.top,
      paddingBottom: 160 + adOffsets.bottom,
      paddingLeft: SAFE_PADDING,
      paddingRight: SAFE_PADDING,
      boxSizing: "border-box",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      transition: "background 0.3s ease, color 0.3s ease",
    }),
    [adOffsets.top, adOffsets.bottom, theme]
  );

  const shellStyle = useMemo(
    () => ({
      width: "100%",
      maxWidth: Math.min(FRAME_WIDTH, Math.max(360, availableWidth)),
      minWidth: "320px",
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: "32px",
      alignItems: "stretch",
      padding: 0,
      boxSizing: "border-box",
    }),
    [availableWidth]
  );

  const highlightTileStyle = useMemo(() => ({
    padding: "16px",
    borderRadius: "18px",
    background: theme === "light" ? "#edf2f7" : "rgba(0,0,0,0.25)",
    border: theme === "light" ? "1px solid #e2e8f0" : "1px solid rgba(255,255,255,0.06)",
  }), [theme]);

  const highlightTiles = [
    { title: "AI-crafted", body: "Free Pollinations model tailors each daily deed." },
    { title: "Caesar Shift", body: "Decode with 26 − shift hint for a fair challenge." },
    { title: "10 words max", body: "Concise instructions keep the mission laser-focused." },
  ];

  const aboutSections = [
    {
      label: "Decode the idea",
      title: "What is a Caesar Cipher?",
      copy: "A Caesar cipher rotates every character by a fixed offset. Shift 21 to encrypt, shift 5 forward (or 21 back) to decrypt—simple math that still feels magical.",
    },
    {
      label: "Why deeds matter",
      title: "Good Deeds, Real Impact",
      copy: "Small intentional acts trigger social resonance. When prompts mirror your zodiac temperament, it becomes easier to act with authenticity each day.",
    },
  ];

  const STARS = useMemo(
    () =>
      Array.from({ length: 500 }).map((_, idx) => ({
        id: idx,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 3 + 1,
        delay: Math.random() * 5,
      })),
    []
  );

  const decorOrbs = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, idx) => ({
        id: idx,
        size: 100 + Math.random() * 140,
        top: `${Math.random() * 80 + 5}%`,
        left: `${Math.random() * 80 + 5}%`,
        blur: Math.random() * 25 + 15,
        opacity: Math.random() * 0.25 + 0.05,
      })),
    []
  );

  const renderExperience = () => {
    const textColor = getTextColor(theme, "primary");
    const textColorSecondary = getTextColor(theme, "secondary");
    const cardBg = getCardBg(theme);
    const cardBorder = getCardBorder(theme);
    
    const progressValue = (step === 0.5 || step === 1) ? 45 : 95;
    const experienceCopy =
      step === 0.5
        ? "Sign in to access your personalized daily good deeds."
        : step === 1
        ? "We'll read your birth date, ask a free AI for the correct zodiac, and craft a deed tailored to your energy."
        : "Decrypt the prompt, follow the hint, and confirm the decoded text to log today's good deed.";

    return (
      <CardFrame theme={theme}>
        <div style={{ maxWidth: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <span style={chipStyle(theme)}>
              {step === 0.5 ? "Sign In" : step === 1 ? "Step 1 / 2" : "Step 2 / 2"}
            </span>
            <span style={chipStyle(theme)}>Daily ritual</span>
            <span style={chipStyle(theme)}>Zodiac fused</span>
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: textColorSecondary }}>
            {(step === 0.5 || step === 1) ? (step === 0.5 ? "Sign In" : "Input → AI prompts") : "Cipher → Decode check"}
          </p>
        </div>

        <div style={{ width: "100%", height: 6, borderRadius: "999px", background: theme === "light" ? "#e2e8f0" : "rgba(255,255,255,0.08)", marginBottom: "24px", overflow: "hidden" }}>
          <div style={{ width: `${progressValue}%`, height: "100%", borderRadius: "999px", background: "linear-gradient(90deg, #8ea4ff, #ff7bc5)", transition: "width 0.4s ease" }} />
        </div>

        {!isSignedIn && step === 0.5 ? (
          <>
            <h1 style={{ margin: "12px 0 8px", fontSize: "34px", color: textColor }}>Sign In</h1>
            <p style={{ color: textColor, marginBottom: "28px" }}>
              Enter your email or username and password to sign in to your account.
            </p>
            <input type="text" value={email} onChange={handleEmailChange} placeholder="Email or username" style={getInputStyle(theme)} />
            <input type="password" value={password} onChange={handlePasswordChange} placeholder="Password" style={{ ...getInputStyle(theme), marginTop: "12px" }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", marginTop: "24px" }}>
              <button onClick={handleSignIn} disabled={loading} style={{ ...buttonStyle(loading), width: "100%" }}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
              <button
                onClick={() => setStep(1)}
                disabled={loading}
                style={{ 
                  ...buttonStyle(loading), 
                  width: "100%",
                  background: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.1)", 
                  border: theme === "light" ? "1px solid #cbd5e0" : "1px solid rgba(255,255,255,0.2)" 
                }}
              >
                Register
              </button>
            </div>
            {error && <p style={{ color: "#ff8a8a", marginTop: "20px" }}>{error}</p>}
          </>
        ) : !isSignedIn && step === 1 ? (
          <>
            <h1 style={{ margin: "12px 0 8px", fontSize: "34px", color: textColor }}>Create Your Profile</h1>
            <p style={{ color: textColor, marginBottom: "28px" }}>
              Sign up with your email, password, and birthday to get personalized daily good deeds based on your zodiac sign.
            </p>
            <input type="email" value={email} onChange={handleEmailChange} placeholder="your@email.com" style={getInputStyle(theme)} />
            <input type="password" value={password} onChange={handlePasswordChange} placeholder="Password (min 4 characters)" style={{ ...getInputStyle(theme), marginTop: "12px" }} />
            <BirthdayInput
              birthdayParts={birthdayParts}
              updateBirthdayParts={updateBirthdayParts}
              monthOptions={monthOptions}
              dayOptions={dayOptions}
              yearOptions={yearOptions}
              theme={theme}
            />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", marginTop: "24px" }}>
              <button
                onClick={handleProfileSubmit}
                disabled={loading}
                style={{ 
                  ...buttonStyle(loading), 
                  width: "100%",
                  background: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.1)", 
                  border: theme === "light" ? "1px solid #cbd5e0" : "1px solid rgba(255,255,255,0.2)" 
                }}
              >
                {loading ? "Creating..." : "Sign Up"}
              </button>
              <button
                onClick={handleSignIn}
                disabled={loading}
                style={{ 
                  ...buttonStyle(loading), 
                  width: "100%",
                  background: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.1)", 
                  border: theme === "light" ? "1px solid #cbd5e0" : "1px solid rgba(255,255,255,0.2)" 
                }}
              >
                Sign In
              </button>
            </div>
            {error && <p style={{ color: "#ff8a8a", marginTop: "20px" }}>{error}</p>}
          </>
        ) : step === 2 && encodedSentence && goodDeed ? (
          <>
            <h1 style={{ margin: "12px 0 8px", fontSize: "34px", color: textColor }}>Uncover Your Good Deed</h1>
            <p style={{ fontSize: "18px", color: textColorSecondary, marginBottom: "16px" }}>{experienceCopy}</p>
            <div style={{ 
              fontSize: "20px", 
              fontWeight: "600", 
              margin: "20px auto", 
              padding: "18px 20px", 
              borderRadius: "18px", 
              background: theme === "light" ? "#edf2f7" : "rgba(255,255,255,0.04)", 
              color: textColor,
              wordBreak: "break-word" 
            }}>
              {encodedSentence}
      </div>
            <p style={{ fontSize: "16px", color: textColorSecondary }}>
              Hint: Rotate letters {decodeShift} steps forward to reveal the truth.
            </p>
            <input type="text" value={userInput} onChange={handleUserInputChange} placeholder="Type the decoded sentence" style={{ ...getInputStyle(theme), width: "100%", marginTop: "24px" }} />
            <button onClick={checkAnswer} style={{ ...buttonStyle(false), width: "100%" }}>Submit answer</button>
            {message && (
              <div style={{ marginTop: "24px", fontSize: "18px", color: message.includes("Correct") ? "#7af5c3" : "#ff8a8a" }}>
                {message}
              </div>
            )}
            {showImageUpload && pendingDeed && (
              <div style={{ marginTop: "32px", padding: "24px", borderRadius: "16px", background: theme === "light" ? "#edf2f7" : "rgba(255,255,255,0.04)", border: theme === "light" ? `1px solid ${cardBorder}` : "1px solid rgba(255,255,255,0.08)" }}>
                <p style={{ fontSize: "16px", color: textColor, marginBottom: "16px", fontWeight: 600 }}>
                  📸 Upload a photo to earn {calculateUploadPoints(pendingDeed.streak)} more points!
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: "none" }}
                  id="experience-image-upload"
                />
                <label
                  htmlFor="experience-image-upload"
                  style={{
                    display: "block",
                    padding: "16px",
                    borderRadius: "12px",
                    background: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.1)",
                    border: theme === "light" ? `2px dashed ${cardBorder}` : "2px dashed rgba(255,255,255,0.2)",
                    textAlign: "center",
                    cursor: "pointer",
                    color: textColor,
                    fontSize: "14px",
                    marginBottom: imagePreview ? "16px" : "0",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.1)";
                  }}
                >
                  {imagePreview ? "Change Image" : "Choose Image"}
                </label>
                {imagePreview && (
                  <div style={{ marginTop: "16px", marginBottom: "16px", textAlign: "center" }}>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "300px",
                        borderRadius: "12px",
                        border: theme === "light" ? `1px solid ${cardBorder}` : "1px solid rgba(255,255,255,0.2)",
                      }}
                    />
                  </div>
                )}
                {imagePreview && (
                  <button
                    onClick={handleImageSubmit}
                    style={{ ...buttonStyle(false), width: "100%" }}
                  >
                    Complete Good Deed (+{calculateUploadPoints(pendingDeed.streak)} pts)
                  </button>
                )}
              </div>
            )}
          </>
        ) : isSignedIn && step === 1 ? (
          <>
            <h1 style={{ margin: "12px 0 8px", fontSize: "34px", color: textColor }}>Loading Your Quest...</h1>
            <p style={{ color: textColor, marginBottom: "28px" }}>
              {loading ? "Consulting the stars..." : "Preparing your personalized good deed..."}
            </p>
            {error && <p style={{ color: "#ff8a8a", marginTop: "20px" }}>{error}</p>}
          </>
        ) : null}

        <div style={{ width: "100%", marginTop: "28px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px" }}>
            {highlightTiles.map((tile) => (
              <div key={tile.title} style={highlightTileStyle}>
                <p style={{ margin: "0 0 6px", fontSize: "14px", color: textColor }}>{tile.title}</p>
                <p style={{ margin: 0, fontSize: "13px", color: textColorSecondary, lineHeight: 1.5 }}>{tile.body}</p>
              </div>
            ))}
          </div>
        </div>
      </CardFrame>
    );
  };

  const renderJournal = () => {
    const textColor = getTextColor(theme, "primary");
    const textColorSecondary = getTextColor(theme, "secondary");
    const cardBg = getCardBg(theme);
    const cardBorder = getCardBorder(theme);
    
    const statItemStyle = {
      padding: "20px",
      borderRadius: "18px",
      background: theme === "light" ? "#edf2f7" : "rgba(0,0,0,0.25)",
      border: theme === "light" ? `1px solid ${cardBorder}` : "1px solid rgba(255,255,255,0.08)",
      marginBottom: "16px",
    };

    const allUsers = getAllUsersData();
    const currentAccountId = getAccountId(profile);
    
    // First, map all users with their original ranks
    const allUsersWithRanks = allUsers.map((user, idx) => ({
      ...user,
      originalRank: idx + 1,
      name: user.email === currentAccountId ? "You" : user.name,
      isCurrentUser: user.email === currentAccountId,
    }));
    
    // Filter by search query (preserving original ranks)
    const filteredUsers = leaderboardSearch.trim() === "" 
      ? allUsersWithRanks 
      : allUsersWithRanks.filter(user => {
          const searchLower = leaderboardSearch.toLowerCase();
          return user.name.toLowerCase().includes(searchLower) || 
                 user.email.toLowerCase().includes(searchLower);
        });
    
    // Limit to top 10 (but keep original ranks)
    const limitedUsers = filteredUsers.slice(0, 10);
    
    const leaderboardData = limitedUsers.map((user) => ({
      rank: user.originalRank, // Use original rank, not position in filtered list
      name: user.name,
      points: user.points,
      streak: user.streak,
      isCurrentUser: user.isCurrentUser,
    }));

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
        <CardFrame theme={theme}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "13px", letterSpacing: "0.2em", textTransform: "uppercase", color: textColorSecondary }}>Your Progress</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "20px", marginTop: "24px" }}>
              <div style={statItemStyle}>
                <p style={{ margin: "0 0 8px", fontSize: "12px", color: textColorSecondary }}>Total Points</p>
                <h2 style={{ margin: 0, fontSize: "32px", background: "linear-gradient(135deg, #ff6bc5, #7076ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {userData.points}
                </h2>
              </div>
              <div style={statItemStyle}>
                <p style={{ margin: "0 0 8px", fontSize: "12px", color: textColorSecondary }}>Current Streak</p>
                <h2 style={{ margin: 0, fontSize: "32px", background: "linear-gradient(135deg, #ffd93d, #ff6bc5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {userData.streak} 🔥
                </h2>
              </div>
              <div style={statItemStyle}>
                <p style={{ margin: "0 0 8px", fontSize: "12px", color: textColorSecondary }}>Deeds Completed</p>
                <h2 style={{ margin: 0, fontSize: "32px", background: "linear-gradient(135deg, #7076ff, #6bcf7f)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {userData.pastDeeds.length}
                </h2>
              </div>
            </div>
          </div>
        </CardFrame>

        <CardFrame theme={theme}>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontSize: "13px", letterSpacing: "0.2em", textTransform: "uppercase", color: textColorSecondary }}>Leaderboard</p>
            <h2 style={{ fontSize: "30px", margin: "10px 0", color: textColor }}>Top Performers</h2>
            
            {/* Search input */}
            <div style={{ marginTop: "20px", marginBottom: "16px", paddingRight: "8px" }}>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={leaderboardSearch}
                onChange={(e) => setLeaderboardSearch(e.target.value)}
                style={{
                  ...getInputStyle(theme),
                  width: "100%",
                  padding: "10px 16px",
                  fontSize: "14px",
                }}
              />
            </div>
            
            {/* Scrollable leaderboard */}
            <div style={{ 
              marginTop: "12px",
              maxHeight: "400px",
              overflowY: "auto",
              overflowX: "hidden",
              paddingRight: "8px",
            }}>
              {leaderboardData.length === 0 ? (
                <p style={{ color: textColorSecondary, marginTop: "20px", textAlign: "center" }}>
                  {leaderboardSearch.trim() === "" 
                    ? "No users on the leaderboard yet. Be the first!"
                    : "No users found matching your search."}
                </p>
              ) : (
                leaderboardData.map((entry, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "16px",
                      borderRadius: "12px",
                      background: entry.isCurrentUser 
                        ? (theme === "light" ? "rgba(101,130,255,0.1)" : "rgba(101,130,255,0.15)")
                        : idx === 0 
                          ? (theme === "light" ? "rgba(255,215,61,0.1)" : "rgba(255,215,61,0.15)")
                          : (theme === "light" ? cardBg : "rgba(255,255,255,0.05)"),
                      border: entry.isCurrentUser 
                        ? (theme === "light" ? "1px solid rgba(101,130,255,0.2)" : "1px solid rgba(101,130,255,0.3)")
                        : idx === 0 
                          ? (theme === "light" ? "1px solid rgba(255,215,61,0.2)" : "1px solid rgba(255,215,61,0.3)")
                          : (theme === "light" ? `1px solid ${cardBorder}` : "1px solid rgba(255,255,255,0.08)"),
                      marginBottom: "12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "20px", fontWeight: "bold", color: textColor }}>#{entry.rank}</span>
                      <span style={{ fontSize: "16px", fontWeight: 600, color: textColor }}>{entry.name}</span>
                    </div>
                    <div style={{ display: "flex", gap: "20px", fontSize: "14px", color: textColorSecondary }}>
                      <span>{entry.points} pts</span>
                      <span>{entry.streak} 🔥</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            {leaderboardData.length === 10 && leaderboardSearch.trim() === "" && (
              <p style={{ fontSize: "12px", color: textColorSecondary, marginTop: "12px", textAlign: "center" }}>
                Showing top 10 performers
              </p>
            )}
          </div>
        </CardFrame>

        <CardFrame theme={theme}>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontSize: "13px", letterSpacing: "0.2em", textTransform: "uppercase", color: textColorSecondary }}>Your Journal</p>
            <h2 style={{ fontSize: "30px", margin: "10px 0", color: textColor }}>Past Good Deeds</h2>
            {userData.pastDeeds.length === 0 ? (
              <p style={{ color: textColorSecondary, marginTop: "20px" }}>
                No deeds logged yet. Complete your first cipher to start your journal!
              </p>
            ) : (
              <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                {userData.pastDeeds.map((deed, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "18px",
                      borderRadius: "16px",
                      background: theme === "light" ? cardBg : "rgba(0,0,0,0.25)",
                      border: theme === "light" ? `1px solid ${cardBorder}` : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                      <span style={{ fontSize: "12px", color: textColorSecondary }}>
                        {new Date(deed.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <div style={{ display: "flex", gap: "12px", fontSize: "12px" }}>
                        <span style={{ color: textColorSecondary }}>
                          +{deed.totalPoints || deed.points || (deed.solvePoints || 0) + (deed.uploadPoints || 0)} pts
                        </span>
                        <span style={{ color: textColorSecondary }}>🔥 {deed.streak}</span>
                      </div>
                    </div>
                    <p style={{ margin: "0 0 12px", color: textColor, lineHeight: 1.6 }}>{deed.deed}</p>
                    {editingDeedIndex === idx ? (
                      <div style={{ marginTop: "12px" }}>
        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const imageDataUrl = await processImageFile(file);
                                const currentAccountId = getAccountId(profile);
                                const currentUserData = getUserData(currentAccountId);
                                const updatedDeeds = [...currentUserData.pastDeeds];
                                const today = getTodayDate();
                                const isTodayDeed = deed.date === today;
                                const hasNoUploadPoints = !deed.uploadPoints || deed.uploadPoints === 0;
                                
                                // If changing an existing image, points were already removed when Change button was clicked
                                // Now add points back for the new image
                                if (isTodayDeed && (!deed.uploadPoints || deed.uploadPoints === 0)) {
                                  // Points were removed when Change was clicked, now add them back
                                  const uploadPoints = calculateUploadPoints(deed.streak);
                                  updatedDeeds[idx] = { 
                                    ...updatedDeeds[idx], 
                                    image: imageDataUrl,
                                    uploadPoints: uploadPoints,
                                    totalPoints: (deed.solvePoints || 0) + uploadPoints,
                                  };
                                  
                                  const updatedData = {
                                    ...currentUserData,
                                    points: currentUserData.points + uploadPoints,
                                    pastDeeds: updatedDeeds,
                                  };
                                  setUserData(updatedData);
                                  saveUserData(currentAccountId, updatedData);
                                  setMessage(`✅ Photo updated! +${uploadPoints} points added back!`);
                                  setTimeout(() => setMessage(""), 5000);
                                  setEditingDeedIndex(null);
                                  return;
                                }
                                
                                // If this is today's deed and doesn't have upload points yet, award them
                                if (isTodayDeed && hasNoUploadPoints) {
                                  const uploadPoints = calculateUploadPoints(deed.streak);
                                  updatedDeeds[idx] = { 
                                    ...updatedDeeds[idx], 
                                    image: imageDataUrl,
                                    uploadPoints: uploadPoints,
                                    totalPoints: (deed.solvePoints || 0) + uploadPoints,
                                  };
                                  
                                  const updatedData = {
                                    ...currentUserData,
                                    points: currentUserData.points + uploadPoints,
                                    pastDeeds: updatedDeeds,
                                  };
                                  setUserData(updatedData);
                                  saveUserData(currentAccountId, updatedData);
                                  setMessage(`✅ Photo uploaded! +${uploadPoints} more points!`);
                                  setTimeout(() => setMessage(""), 5000);
                                } else {
                                  // For past deeds or deeds without upload points, just update image
                                  updatedDeeds[idx] = { ...updatedDeeds[idx], image: imageDataUrl };
                                  const updatedData = {
                                    ...currentUserData,
                                    pastDeeds: updatedDeeds,
                                  };
                                  setUserData(updatedData);
                                  saveUserData(currentAccountId, updatedData);
                                }
                                setEditingDeedIndex(null);
                              } catch (err) {
                                setError(err.message);
                              }
                            }
                          }}
                          style={{ display: "none" }}
                          id={`image-upload-${idx}`}
                        />
                        <label
                          htmlFor={`image-upload-${idx}`}
                          style={{
                            display: "inline-block",
                            padding: "8px 16px",
                            borderRadius: "8px",
                            background: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.1)",
                            border: theme === "light" ? "1px solid #cbd5e0" : "1px solid rgba(255,255,255,0.2)",
                            cursor: "pointer",
                            fontSize: "13px",
                            color: textColor,
                          }}
                        >
                          Choose Image
                        </label>
                        <button
                          onClick={() => setEditingDeedIndex(null)}
                          style={{
                            marginLeft: "8px",
                            padding: "8px 16px",
                            borderRadius: "8px",
                            background: theme === "light" ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.05)",
                            border: theme === "light" ? "1px solid #e2e8f0" : "1px solid rgba(255,255,255,0.1)",
                            cursor: "pointer",
                            fontSize: "13px",
                            color: textColorSecondary,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        {deed.image ? (
                          <div style={{ marginTop: "12px", position: "relative" }}>
                            <img
                              src={deed.image}
                              alt="Good deed"
                              style={{
                                width: "100%",
                                maxHeight: "300px",
                                objectFit: "cover",
                                borderRadius: "12px",
                                border: "1px solid rgba(255,255,255,0.1)",
                              }}
                            />
                            <button
                              onClick={() => {
                                // Subtract upload points immediately when clicking Change button
                                const currentAccountId = getAccountId(profile);
                                const currentUserData = getUserData(currentAccountId);
                                const today = getTodayDate();
                                const isTodayDeed = deed.date === today;
                                
                                if (isTodayDeed && deed.uploadPoints && deed.uploadPoints > 0) {
                                  const pointsToRemove = deed.uploadPoints;
                                  const updatedDeeds = [...currentUserData.pastDeeds];
                                  updatedDeeds[idx] = {
                                    ...deed,
                                    uploadPoints: 0,
                                    totalPoints: (deed.solvePoints || 0),
                                  };
                                  
                                  const updatedData = {
                                    ...currentUserData,
                                    points: Math.max(0, currentUserData.points - pointsToRemove),
                                    pastDeeds: updatedDeeds,
                                  };
                                  
                                  setUserData(updatedData);
                                  saveUserData(currentAccountId, updatedData);
                                  setMessage(`⚠️ Photo changed. Upload points (${pointsToRemove}) removed. Select new photo to earn them back!`);
                                  setTimeout(() => setMessage(""), 5000);
                                }
                                
                                setEditingDeedIndex(idx);
                              }}
                              style={{
                                position: "absolute",
                                top: "8px",
                                right: "8px",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                background: theme === "light" ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.7)",
                                border: theme === "light" ? "1px solid #cbd5e0" : "1px solid rgba(255,255,255,0.2)",
                                cursor: "pointer",
                                fontSize: "12px",
                                color: theme === "light" ? "#1a202c" : "rgba(255,255,255,0.9)",
                              }}
                            >
                              Change
                            </button>
                          </div>
                        ) : (
                          <div style={{ marginTop: "12px" }}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const imageDataUrl = await processImageFile(file);
                                    const currentAccountId = getAccountId(profile);
                                    const currentUserData = getUserData(currentAccountId);
                                    const updatedDeeds = [...currentUserData.pastDeeds];
                                    const today = getTodayDate();
                                    const isTodayDeed = deed.date === today;
                                    const hasNoUploadPoints = !deed.uploadPoints || deed.uploadPoints === 0;
                                    
                                    // If this is today's deed and doesn't have upload points yet, award them
                                    if (isTodayDeed && hasNoUploadPoints) {
                                      const uploadPoints = calculateUploadPoints(deed.streak);
                                      updatedDeeds[idx] = { 
                                        ...updatedDeeds[idx], 
                                        image: imageDataUrl,
                                        uploadPoints: uploadPoints,
                                        totalPoints: (deed.solvePoints || 0) + uploadPoints,
                                      };
                                      
                                      const updatedData = {
                                        ...currentUserData,
                                        points: currentUserData.points + uploadPoints,
                                        pastDeeds: updatedDeeds,
                                      };
                                      setUserData(updatedData);
                                      saveUserData(currentAccountId, updatedData);
                                      setMessage(`✅ Photo uploaded! +${uploadPoints} more points!`);
                                      setTimeout(() => setMessage(""), 5000);
                                    } else {
                                      // Just add the image without points
                                      updatedDeeds[idx] = { ...updatedDeeds[idx], image: imageDataUrl };
                                      const updatedData = {
                                        ...currentUserData,
                                        pastDeeds: updatedDeeds,
                                      };
                                      setUserData(updatedData);
                                      saveUserData(currentAccountId, updatedData);
                                    }
                                  } catch (err) {
                                    setError(err.message);
                                  }
                                }
                              }}
                              style={{ display: "none" }}
                              id={`image-upload-${idx}`}
                            />
                            <label
                              htmlFor={`image-upload-${idx}`}
                              style={{
                                display: "inline-block",
                                padding: "8px 16px",
                                borderRadius: "8px",
                                background: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.1)",
                                border: theme === "light" ? "1px solid #cbd5e0" : "1px solid rgba(255,255,255,0.2)",
                                cursor: "pointer",
                                fontSize: "13px",
                                color: textColor,
                              }}
                            >
                              {deed.date === getTodayDate() && (!deed.uploadPoints || deed.uploadPoints === 0) 
                                ? `Upload Image (+${calculateUploadPoints(deed.streak)} pts)` 
                                : "Upload Image"}
                            </label>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardFrame>
      </div>
    );
  };

  const renderSettings = () => {
    const textColor = getTextColor(theme, "primary");
    const textColorSecondary = getTextColor(theme, "secondary");
    
    if (!isSignedIn) {
  return (
        <CardFrame theme={theme}>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ margin: "12px 0 8px", fontSize: "34px", color: textColor }}>Settings</h1>
            <p style={{ color: textColorSecondary, marginBottom: "28px" }}>
              Please sign in to access settings.
            </p>
            <button onClick={handleSignInClick} style={buttonStyle(false)}>
              Sign In
        </button>
      </div>
        </CardFrame>
    );
  }

    const cardBg = getCardBg(theme);
    const cardBorder = getCardBorder(theme);
    const themeInputStyle = getInputStyle(theme);

  return (
      <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
        <CardFrame theme={theme}>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontSize: "13px", letterSpacing: "0.2em", textTransform: "uppercase", color: textColorSecondary }}>Account</p>
            <h2 style={{ fontSize: "30px", margin: "10px 0", color: textColor }}>Account Details</h2>
            
            <div style={{ marginTop: "24px", padding: "16px", borderRadius: "12px", background: cardBg, border: `1px solid ${cardBorder}` }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", color: textColorSecondary, fontWeight: 600 }}>
                  EMAIL
                </label>
                <p style={{ margin: 0, fontSize: "16px", color: textColor }}>{profile?.email || "N/A"}</p>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", color: textColorSecondary, fontWeight: 600 }}>
                  USERNAME
                </label>
                {editingUsername ? (
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
      <input
        type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                      style={{ ...themeInputStyle, flex: 1, marginTop: 0, padding: "8px 12px", fontSize: "14px" }}
      />
      <button
                      onClick={handleUsernameUpdate}
                      style={{ ...buttonStyle(false), marginTop: 0, padding: "8px 16px", fontSize: "13px" }}
      >
                      Save
      </button>
                    <button
                      onClick={() => {
                        setEditingUsername(false);
                        const savedProfile = getProfile();
                        setUsername(savedProfile?.username || "");
                      }}
                      style={{ 
                        ...buttonStyle(false), 
                        marginTop: 0, 
                        padding: "8px 16px", 
                        fontSize: "13px",
                        background: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.1)",
                        border: `1px solid ${cardBorder}`,
                        color: textColor,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ margin: 0, fontSize: "16px", color: textColor }}>{username || "Not set"}</p>
                    <button
                      onClick={() => setEditingUsername(true)}
                      style={{ 
                        ...buttonStyle(false), 
                        marginTop: 0, 
                        padding: "6px 12px", 
                        fontSize: "12px",
                        background: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.1)",
                        border: `1px solid ${cardBorder}`,
                        color: textColor,
                      }}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", color: textColorSecondary, fontWeight: 600 }}>
                  BIRTHDAY
                </label>
                {editingBirthday ? (
                  <div>
                    <BirthdayInput
                      birthdayParts={settingsBirthdayParts}
                      updateBirthdayParts={updateSettingsBirthdayParts}
                      monthOptions={monthOptions}
                      dayOptions={settingsDayOptions}
                      yearOptions={yearOptions}
                    />
                    <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                      <button
                        onClick={handleBirthdayUpdate}
                        style={{ ...buttonStyle(false), marginTop: 0, padding: "8px 16px", fontSize: "13px" }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingBirthday(false);
                          const savedProfile = getProfile();
                          if (savedProfile?.birthday) {
                            const date = new Date(savedProfile.birthday);
                            setSettingsBirthdayParts({
                              month: String(date.getMonth() + 1).padStart(2, '0'),
                              day: String(date.getDate()).padStart(2, '0'),
                              year: String(date.getFullYear()),
                            });
                          } else {
                            setSettingsBirthdayParts({ month: "", day: "", year: "" });
                          }
                        }}
                        style={{ 
                          ...buttonStyle(false), 
                          marginTop: 0, 
                          padding: "8px 16px", 
                          fontSize: "13px",
                          background: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.1)",
                          border: `1px solid ${cardBorder}`,
                          color: textColor,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ margin: 0, fontSize: "16px", color: textColor }}>
                      {profile?.birthday ? new Date(profile.birthday).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Not set"}
                    </p>
                    <button
                      onClick={() => setEditingBirthday(true)}
                      style={{ 
                        ...buttonStyle(false), 
                        marginTop: 0, 
                        padding: "6px 12px", 
                        fontSize: "12px",
                        background: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.1)",
                        border: `1px solid ${cardBorder}`,
                        color: textColor,
                      }}
                    >
                      Edit
      </button>
        </div>
      )}
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", color: textColorSecondary, fontWeight: 600 }}>
                  TOTAL POINTS
                </label>
                <p style={{ margin: 0, fontSize: "16px", color: textColor }}>{userData.points}</p>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", color: textColorSecondary, fontWeight: 600 }}>
                  CURRENT STREAK
                </label>
                <p style={{ margin: 0, fontSize: "16px", color: textColor }}>{userData.streak} days 🔥</p>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", color: textColorSecondary, fontWeight: 600 }}>
                  DEEDS COMPLETED
                </label>
                <p style={{ margin: 0, fontSize: "16px", color: textColor }}>{userData.pastDeeds.length}</p>
              </div>
            </div>
          </div>
        </CardFrame>

        <CardFrame theme={theme}>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontSize: "13px", letterSpacing: "0.2em", textTransform: "uppercase", color: textColorSecondary }}>Security</p>
            <h2 style={{ fontSize: "30px", margin: "10px 0", color: textColor }}>Change Password</h2>
            
            <div style={{ marginTop: "24px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", color: textColor }}>
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                style={{ ...themeInputStyle, width: "60%", maxWidth: "300px" }}
              />
        </div>

            <div style={{ marginTop: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", color: textColor }}>
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 characters)"
                style={{ ...themeInputStyle, width: "60%", maxWidth: "300px" }}
              />
              <p style={{ marginTop: "6px", fontSize: "12px", color: textColorSecondary }}>
                Must be at least 8 characters long
              </p>
            </div>

            <div style={{ marginTop: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", color: textColor }}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                style={{ ...themeInputStyle, width: "60%", maxWidth: "300px" }}
              />
            </div>

            <button onClick={handlePasswordReset} style={buttonStyle(false)}>
              Update Password
            </button>
          </div>
        </CardFrame>

        <CardFrame theme={theme}>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontSize: "13px", letterSpacing: "0.2em", textTransform: "uppercase", color: textColorSecondary }}>Appearance</p>
            <h2 style={{ fontSize: "30px", margin: "10px 0" }}>Theme</h2>
            
            <div style={{ marginTop: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", borderRadius: "12px", background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 600, color: textColor }}>Theme</p>
                  <p style={{ margin: 0, fontSize: "13px", color: textColorSecondary }}>
                    Current: {theme === "dark" ? "Dark" : "Light"}
                  </p>
                </div>
                <button
                  onClick={handleThemeToggle}
                  style={{
                    ...buttonStyle(false),
                    minWidth: "120px",
                    alignSelf: "center",
                  }}
                >
                  Switch to {theme === "dark" ? "Light" : "Dark"}
                </button>
              </div>
            </div>
          </div>
        </CardFrame>

        <CardFrame theme={theme}>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontSize: "13px", letterSpacing: "0.2em", textTransform: "uppercase", color: textColorSecondary }}>Danger Zone</p>
            <h2 style={{ fontSize: "30px", margin: "10px 0", color: "#ff8a8a" }}>Delete Account</h2>
            <p style={{ color: textColor, marginTop: "12px", lineHeight: 1.6 }}>
              Permanently delete your account and all associated data. This action cannot be undone.
              Your account will be removed from the leaderboard and all your progress will be lost.
            </p>
            <button
              onClick={handleDeleteAccount}
              style={{
                ...buttonStyle(false),
                marginTop: "20px",
                background: "#ff4444",
                border: "1px solid #ff6666",
                color: "#fff",
              }}
            >
              Delete Account
            </button>
        </div>
        </CardFrame>

        {error && (
          <CardFrame theme={theme}>
            <p style={{ color: "#ff8a8a", textAlign: "center" }}>{error}</p>
          </CardFrame>
        )}
        {message && message.includes("Password updated") && (
          <CardFrame theme={theme}>
            <p style={{ color: "#7af5c3", textAlign: "center" }}>{message}</p>
          </CardFrame>
        )}
      </div>
    );
  };

  const renderAbout = () => {
    const textColor = getTextColor(theme, "primary");
    const textColorSecondary = getTextColor(theme, "secondary");
    const cardBg = getCardBg(theme);
    const cardBorder = getCardBorder(theme);
    
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "28px", width: "100%" }}>
        {aboutSections.map((section) => (
          <CardFrame key={section.title} theme={theme}>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: "13px", letterSpacing: "0.2em", textTransform: "uppercase", color: textColorSecondary }}>{section.label}</p>
              <h2 style={{ fontSize: "30px", margin: "10px 0", color: textColor }}>{section.title}</h2>
              <p style={{ color: textColor, lineHeight: 1.7 }}>{section.copy}</p>
            </div>
          </CardFrame>
        ))}

        <CardFrame theme={theme}>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontSize: "13px", letterSpacing: "0.2em", textTransform: "uppercase", color: textColorSecondary }}>Zodiac essence</p>
            <h2 style={{ fontSize: "30px", margin: "10px 0", color: textColor }}>Nature of Each Sign</h2>
            <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
              {zodiacInsights.map((item) => (
                <div key={item.sign} style={{ 
                  padding: "16px", 
                  borderRadius: "18px", 
                  background: theme === "light" ? "#edf2f7" : "rgba(0,0,0,0.3)", 
                  border: theme === "light" ? `1px solid ${cardBorder}` : "1px solid rgba(255,255,255,0.05)" 
                }}>
                  <h3 style={{ margin: "0 0 8px", fontSize: "18px", color: textColor }}>{item.sign}</h3>
                  <p style={{ margin: 0, color: textColor, lineHeight: 1.5 }}>{item.note}</p>
                </div>
              ))}
            </div>
          </div>
        </CardFrame>
      </div>
    );
  };

  const renderCommunity = () => {
    const textColor = getTextColor(theme, "primary");
    const textColorSecondary = getTextColor(theme, "secondary");
    const cardBg = getCardBg(theme);
    const cardBorder = getCardBorder(theme);
    const currentAccountId = getAccountId(profile);
    
    // Get all public entries
    let entries = getAllPublicEntries();
    
    // Add like counts and liked status
    // Reference likesUpdate to trigger re-render when likes change
    const _ = likesUpdate;
    entries = entries.map(entry => ({
      ...entry,
      likeCount: getLikeCount(entry.entryId),
      isLiked: currentAccountId ? hasUserLiked(entry.entryId, currentAccountId) : false,
    }));
    
    // Sort entries
    if (communitySort === "popular") {
      entries.sort((a, b) => b.likeCount - a.likeCount || new Date(b.date) - new Date(a.date));
    } else {
      // Latest first
      entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    
    const handleLike = (entryId) => {
      if (!currentAccountId) {
        setMessage("Please sign in to like entries");
        setTimeout(() => setMessage(""), 3000);
        return;
      }
      
      toggleLike(entryId, currentAccountId);
      // Force re-render by updating likes counter
      setLikesUpdate(prev => prev + 1);
    };
    
    const formatDate = (dateStr) => {
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      } catch {
        return dateStr;
      }
    };
    
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
        <CardFrame theme={theme}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "13px", letterSpacing: "0.2em", textTransform: "uppercase", color: textColorSecondary }}>Community</p>
            <h2 style={{ fontSize: "30px", margin: "10px 0", color: textColor }}>Explore Good Deeds</h2>
            <p style={{ color: textColorSecondary, marginTop: "8px" }}>See what others are doing and spread positivity!</p>
            
            {/* Sort dropdown */}
            <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
              <div style={{ position: "relative" }}>
                <select
                  value={communitySort}
                  onChange={(e) => setCommunitySort(e.target.value)}
                  data-theme={theme}
                  style={{
                    padding: "10px 40px 10px 16px",
                    borderRadius: "999px",
                    border: theme === "light" 
                      ? "1px solid #cbd5e0" 
                      : "1px solid rgba(255,255,255,0.2)",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: textColor,
                    background: theme === "light" 
                      ? "#ffffff" 
                      : "rgba(255,255,255,0.05)",
                    cursor: "pointer",
                    appearance: "none",
                    WebkitAppearance: "none",
                    MozAppearance: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='${theme === "light" ? "%234a5568" : "%23f0f4ff"}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 12px center",
                    paddingRight: "40px",
                  }}
                >
                  <option value="latest" style={{ 
                    background: theme === "light" ? "#ffffff" : "#1a1c24",
                    color: theme === "light" ? "#1a202c" : "#f7f8fb"
                  }}>Latest</option>
                  <option value="popular" style={{ 
                    background: theme === "light" ? "#ffffff" : "#1a1c24",
                    color: theme === "light" ? "#1a202c" : "#f7f8fb"
                  }}>Most Popular</option>
                </select>
              </div>
            </div>
          </div>
        </CardFrame>
        
        {entries.length === 0 ? (
          <CardFrame theme={theme}>
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ color: textColorSecondary, fontSize: "16px" }}>
                No community entries yet. Be the first to share your good deed!
              </p>
            </div>
          </CardFrame>
        ) : (
          entries.map((entry) => (
            <CardFrame key={entry.entryId} theme={theme}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* User info and date */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: textColor }}>
                      {entry.email === currentAccountId ? "You" : entry.username}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: textColorSecondary }}>
                      {formatDate(entry.date)}
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "11px", color: textColorSecondary }}>
                      {entry.streak} 🔥
                    </span>
                  </div>
                </div>
                
                {/* Good deed text */}
                <div style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: theme === "light" ? "#edf2f7" : "rgba(0,0,0,0.25)",
                  border: theme === "light" ? `1px solid ${cardBorder}` : "1px solid rgba(255,255,255,0.08)",
                }}>
                  <p style={{ margin: 0, fontSize: "13px", color: textColor, lineHeight: 1.5 }}>
                    {entry.deed}
                  </p>
                </div>
                
                {/* Image */}
                {entry.image && (
                  <div style={{ position: "relative", width: "100%", borderRadius: "8px", overflow: "hidden" }}>
                    <img
                      src={entry.image}
                      alt="Good deed"
                      style={{
                        width: "100%",
                        maxHeight: "250px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: theme === "light" ? `1px solid ${cardBorder}` : "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                  </div>
                )}
                
                {/* Like button and count */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    onClick={() => handleLike(entry.entryId)}
                    disabled={!currentAccountId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      borderRadius: "999px",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: entry.isLiked 
                        ? (theme === "light" ? "#dc2626" : "#ff6b9d")
                        : (theme === "light" ? "#4a5568" : "#f0f4ff"),
                      background: entry.isLiked
                        ? (theme === "light" 
                            ? "rgba(220, 38, 38, 0.1)" 
                            : "rgba(255, 107, 157, 0.15)")
                        : (theme === "light" 
                            ? "rgba(0,0,0,0.05)" 
                            : "rgba(255,255,255,0.05)"),
                      cursor: currentAccountId ? "pointer" : "not-allowed",
                      transition: "all 0.2s ease",
                      opacity: currentAccountId ? 1 : 0.6,
                    }}
                  >
                    <span style={{ fontSize: "14px" }}>{entry.isLiked ? "❤️" : "🤍"}</span>
                    <span>{entry.likeCount}</span>
                  </button>
                  {!currentAccountId && (
                    <span style={{ fontSize: "11px", color: textColorSecondary }}>
                      Sign in to like
                    </span>
                  )}
                </div>
              </div>
            </CardFrame>
          ))
        )}
      </div>
    );
  };

  return (
    <div style={pageStyle}>
      {decorOrbs.map((orb) => (
        <div
          key={orb.id}
          style={{
            position: "absolute",
            top: orb.top,
            left: orb.left,
            width: orb.size,
            height: orb.size,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(116,130,255,0.18), rgba(31,33,40,0))",
            filter: `blur(${orb.blur}px)`,
            opacity: orb.opacity,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      ))}
      {STARS.map((star) => (
        <div
          key={star.id}
          style={{
            position: "absolute",
            top: `${star.top}%`,
            left: `${star.left}%`,
            width: star.size,
            height: star.size,
            borderRadius: "50%",
            background: theme === "light" ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.85)",
            boxShadow: theme === "light" ? "0 0 4px rgba(0,0,0,0.3)" : "0 0 8px rgba(255,255,255,0.6)",
            animation: `twinkle 3s ease-in-out ${star.delay}s infinite alternate`,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      ))}
      <div style={shellStyle}>
        <header style={topBarStyle(adOffsets, theme)}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: 42, height: 42, borderRadius: "12px", background: "linear-gradient(135deg, #ff6bc5, #7076ff)" }} />
            <div>
              <p style={{ margin: 0, fontSize: "12px", letterSpacing: "0.2em", color: getTextColor(theme, "secondary") }}>Decode Daily</p>
              <h1 style={{ margin: 0, fontSize: "20px", color: getTextColor(theme, "primary") }}>Zodiac Cipher</h1>
            </div>
          </div>
          <div ref={menuRef} style={{ display: "flex", gap: "12px", alignItems: "center", position: "relative" }}>
            {/* Burger menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                padding: "8px",
                borderRadius: "8px",
                border: "none",
                background: theme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.1)",
                cursor: "pointer",
                width: "36px",
                height: "36px",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <div style={{
                width: "20px",
                height: "2px",
                background: getTextColor(theme, "primary"),
                transition: "all 0.3s ease",
                transform: menuOpen ? "rotate(45deg) translate(5px, 5px)" : "none",
              }} />
              <div style={{
                width: "20px",
                height: "2px",
                background: getTextColor(theme, "primary"),
                transition: "all 0.3s ease",
                opacity: menuOpen ? 0 : 1,
              }} />
              <div style={{
                width: "20px",
                height: "2px",
                background: getTextColor(theme, "primary"),
                transition: "all 0.3s ease",
                transform: menuOpen ? "rotate(-45deg) translate(5px, -5px)" : "none",
              }} />
            </button>
            
            {/* Dropdown menu */}
            {menuOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 12px)",
                right: 0,
                minWidth: "200px",
                borderRadius: "16px",
                background: theme === "light" 
                  ? "linear-gradient(135deg, #ffffff 0%, #f7fafc 100%)" 
                  : "rgba(4, 6, 18, 0.95)",
                border: theme === "light" 
                  ? "1px solid #e2e8f0" 
                  : "1px solid rgba(255,255,255,0.08)",
                boxShadow: theme === "light" 
                  ? "0 20px 60px rgba(0,0,0,0.08)" 
                  : "0 20px 60px rgba(0,0,0,0.45)",
                backdropFilter: "blur(16px)",
                zIndex: 1000,
                padding: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}>
                <button 
                  style={{
                    ...navButtonStyle(view === "home", theme),
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 16px",
                    borderRadius: "12px",
                  }}
                  onClick={() => {
                    setView("home");
                    setMenuOpen(false);
                  }}
                >
                  Experience
                </button>
                <button 
                  style={{
                    ...navButtonStyle(view === "journal", theme),
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 16px",
                    borderRadius: "12px",
                  }}
                  onClick={() => {
                    setView("journal");
                    setMenuOpen(false);
                  }}
                >
                  Journal
                </button>
                <button 
                  style={{
                    ...navButtonStyle(view === "community", theme),
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 16px",
                    borderRadius: "12px",
                  }}
                  onClick={() => {
                    setView("community");
                    setMenuOpen(false);
                  }}
                >
                  Community
                </button>
                <button 
                  style={{
                    ...navButtonStyle(view === "about", theme),
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 16px",
                    borderRadius: "12px",
                  }}
                  onClick={() => {
                    setView("about");
                    setMenuOpen(false);
                  }}
                >
                  About
                </button>
                {isSignedIn && (
                  <button 
                    style={{
                      ...navButtonStyle(view === "settings", theme),
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 16px",
                      borderRadius: "12px",
                    }}
                    onClick={() => {
                      setView("settings");
                      setMenuOpen(false);
                    }}
                  >
                    Settings
                  </button>
                )}
                <div style={{
                  height: "1px",
                  background: theme === "light" ? "#e2e8f0" : "rgba(255,255,255,0.1)",
                  margin: "4px 0",
                }} />
                {isSignedIn ? (
                  <button
                    onClick={() => {
                      handleSignOut();
                      setMenuOpen(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "none",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: theme === "light" ? "#dc2626" : "#ff6b9d",
                      background: theme === "light" ? "rgba(220, 38, 38, 0.1)" : "rgba(255, 107, 157, 0.15)",
                      cursor: "pointer",
                    }}
                  >
                    Sign Out
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleSignInClick();
                      setMenuOpen(false);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "none",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#ffffff",
                      background: "linear-gradient(135deg, #ff6bc5, #7076ff)",
                      cursor: "pointer",
                    }}
                  >
                    Sign In / Register
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        <main>
          {view === "home" ? renderExperience() : view === "journal" ? renderJournal() : view === "community" ? renderCommunity() : view === "settings" ? renderSettings() : renderAbout()}
        </main>

        <footer style={{ ...footerStyle, background: theme === "dark" ? "#272a33" : "linear-gradient(135deg, #ffffff 0%, #f7fafc 100%)", border: theme === "dark" ? "1px solid rgba(255,255,255,0.05)" : "1px solid #e2e8f0" }}>
          <div>
            <h3 style={{ marginTop: 0, fontSize: "16px", color: getTextColor(theme, "primary") }}>Contact</h3>
            <p style={{ color: getTextColor(theme, "secondary"), fontSize: "14px", marginTop: "8px", lineHeight: 1.6 }}>
              If you have any concerns or questions, please email us at{" "}
              <a 
                href="mailto:jkadakiabusiness@gmail.com" 
                style={{ 
                  color: theme === "dark" ? "#8ea4ff" : "#4f46e5",
                  textDecoration: "none",
                  fontWeight: 500
                }}
              >
                jkadakiabusiness@gmail.com
              </a>
            </p>
          </div>
          <div>
            <h3 style={{ marginTop: 0, fontSize: "16px", color: getTextColor(theme, "primary") }}>Terms & Conditions</h3>
            <p style={{ color: getTextColor(theme, "primary"), lineHeight: 1.6, fontSize: "13px" }}>
              This experience is for inspiration only. Deeds are suggestions; apply your own judgment and local guidelines. By using this app you agree to act responsibly and respect others' boundaries.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
