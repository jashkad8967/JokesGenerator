/**
 * Authentication and profile management utilities
 */

import { getProfile, saveProfile, getProfileByEmail } from "./storage";

/**
 * Clears the user profile from localStorage
 */
export const clearProfile = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("zodiacCipherProfile");
  }
};

/**
 * Signs out the user by clearing profile data
 * @returns {Object} Reset state values
 */
export const signOut = () => {
  clearProfile();
  return {
    profile: null,
    isSignedIn: false,
    email: "",
    birthday: "",
    birthdayParts: { month: "", day: "", year: "" },
    step: 1,
    view: "home",
  };
};

/**
 * Finds a profile by username
 * @param {string} username - Username to search for
 * @returns {Object|null} Profile object or null
 */
const getProfileByUsername = (username) => {
  if (typeof window === "undefined" || !username) return null;
  
  try {
    const profiles = JSON.parse(localStorage.getItem("zodiacCipherProfiles") || "[]");
    return profiles.find((p) => p.username && p.username.toLowerCase() === username.toLowerCase()) || null;
  } catch {
    return null;
  }
};

/**
 * Signs in a user with email/username and password
 * @param {string} identifier - User's email address or username
 * @param {string} password - User's password
 * @returns {Object} Profile object
 * @throws {Error} If identifier or password is invalid
 */
export const signIn = (identifier, password) => {
  if (!identifier) {
    throw new Error("Please enter your email or username.");
  }
  if (!password || password.length < 4) {
    throw new Error("Password must be at least 4 characters.");
  }

  // Try to find profile by email first, then by username
  let profile = null;
  if (identifier.includes("@")) {
    // It's an email
    profile = getProfileByEmail(identifier);
  } else {
    // It's a username
    profile = getProfileByUsername(identifier);
  }

  if (!profile) {
    throw new Error("No account found with this email or username. Please register.");
  }
  if (profile.password !== password) {
    throw new Error("Incorrect password.");
  }

  // Set as current profile
  saveProfile(profile);
  return profile;
};

/**
 * Registers a new user with email, password, and birthday
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @param {string} isoBirthday - Birthday in ISO format
 * @returns {Object} New profile object
 * @throws {Error} If email, password, or birthday is invalid
 */
export const register = (email, password, isoBirthday) => {
  if (!email || !email.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }
  if (!password || password.length < 4) {
    throw new Error("Password must be at least 4 characters.");
  }
  if (!isoBirthday) {
    throw new Error("Please select a complete birthday.");
  }

  // Check if email already exists
  const existingProfile = getProfileByEmail(email);
  if (existingProfile) {
    throw new Error("An account with this email already exists. Please sign in.");
  }

  // Check if default username is already taken
  const defaultUsername = email.split("@")[0];
  const existingUsernameProfile = getProfileByUsername(defaultUsername);
  if (existingUsernameProfile) {
    // If username is taken, append a number
    let newUsername = defaultUsername;
    let counter = 1;
    while (getProfileByUsername(newUsername)) {
      newUsername = `${defaultUsername}${counter}`;
      counter++;
    }
    const newProfile = { 
      email, 
      password, 
      birthday: isoBirthday,
      username: newUsername,
      theme: "dark", // Default theme
    };
    saveProfile(newProfile);
    return newProfile;
  }

  const newProfile = { 
    email, 
    password, 
    birthday: isoBirthday,
    username: defaultUsername, // Default username from email
    theme: "dark", // Default theme
  };
  saveProfile(newProfile);
  return newProfile;
};

/**
 * Deletes an account and all associated data
 * @param {string} email - Email of account to delete
 */
export const deleteAccount = (email) => {
  if (typeof window === "undefined" || !email) return;

  try {
    // Remove user data
    const userDataKey = `zodiacCipherUserData_${email}`;
    localStorage.removeItem(userDataKey);

    // Remove from profiles list
    const profiles = JSON.parse(localStorage.getItem("zodiacCipherProfiles") || "[]");
    const filteredProfiles = profiles.filter((p) => p.email !== email);
    localStorage.setItem("zodiacCipherProfiles", JSON.stringify(filteredProfiles));

    // If it's the current profile, clear it
    const currentProfile = getProfile();
    if (currentProfile && currentProfile.email === email) {
      clearProfile();
    }
  } catch (err) {
    console.error("Failed to delete account:", err);
    throw new Error("Failed to delete account. Please try again.");
  }
};

/**
 * Updates user profile
 * @param {string} email - User's email
 * @param {Object} updates - Fields to update (username, theme, etc.)
 * @returns {Object} Updated profile
 */
export const updateProfile = (email, updates) => {
  const profile = getProfileByEmail(email);
  if (!profile) {
    throw new Error("Profile not found.");
  }

  // Check for duplicate username if username is being updated
  if (updates.username) {
    const existingProfile = getProfileByUsername(updates.username);
    if (existingProfile && existingProfile.email !== email) {
      throw new Error("This username is already taken. Please choose another.");
    }
  }

  const updatedProfile = { ...profile, ...updates };
  saveProfile(updatedProfile);
  return updatedProfile;
};

/**
 * Resets password for a user
 * @param {string} email - User's email
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @param {string} confirmPassword - Confirmation of new password
 * @returns {Object} Updated profile
 * @throws {Error} If validation fails
 */
export const resetPassword = (email, currentPassword, newPassword, confirmPassword) => {
  if (!newPassword || newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters long.");
  }
  
  if (newPassword !== confirmPassword) {
    throw new Error("New passwords do not match.");
  }

  const profile = getProfileByEmail(email);
  if (!profile) {
    throw new Error("Profile not found.");
  }

  if (profile.password !== currentPassword) {
    throw new Error("Current password is incorrect.");
  }

  if (newPassword === currentPassword) {
    throw new Error("New password must be different from current password.");
  }

  const updatedProfile = { ...profile, password: newPassword };
  saveProfile(updatedProfile);
  return updatedProfile;
};

/**
 * Signs in or registers a user (legacy support)
 * @param {string} email - User's email address
 * @param {string} isoBirthday - Birthday in ISO format
 * @returns {Object} New profile object
 * @throws {Error} If email or birthday is invalid
 */
export const signInOrRegister = (email, isoBirthday) => {
  if (!email || !email.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }
  if (!isoBirthday) {
    throw new Error("Please select a complete birthday.");
  }

  const newProfile = { email, birthday: isoBirthday };
  saveProfile(newProfile);
  return newProfile;
};
