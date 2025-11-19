// LocalStorage utilities - Account-based storage
export const STORAGE_KEY_PREFIX = "zodiacCipherUserData_";
export const PROFILE_KEY = "zodiacCipherProfile";
export const PROFILES_KEY = "zodiacCipherProfiles"; // Store all profiles

/**
 * Get storage key for a specific account
 * @param {string} accountId - Email for signed-in users
 * @returns {string} Storage key
 */
const getAccountKey = (accountId) => `${STORAGE_KEY_PREFIX}${accountId}`;

/**
 * Get account ID from profile
 * @param {Object|null} profile - User profile
 * @returns {string|null} Account ID or null if no profile
 */
export const getAccountId = (profile) => {
  return profile?.email || null;
};

/**
 * Get user data for a specific account
 * @param {string} accountId - Account ID (email)
 * @returns {Object} User data
 */
export const getUserData = (accountId) => {
  try {
    const key = getAccountKey(accountId);
    const data = localStorage.getItem(key);
    return data
      ? JSON.parse(data)
      : { points: 0, streak: 0, lastDeedDate: null, pastDeeds: [], leaderboard: [] };
  } catch {
    return { points: 0, streak: 0, lastDeedDate: null, pastDeeds: [], leaderboard: [] };
  }
};

/**
 * Save user data for a specific account
 * @param {string} accountId - Account ID (email)
 * @param {Object} data - User data to save
 */
export const saveUserData = (accountId, data) => {
  try {
    const key = getAccountKey(accountId);
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save user data:", err);
  }
};

/**
 * Get all user data from all accounts for leaderboard
 * @returns {Array} Array of {email, points, streak} objects
 */
export const getAllUsersData = () => {
  try {
    const allUsers = [];
    const profiles = getAllProfiles();
    const usernameMap = new Map(); // Track usernames to prevent duplicates
    
    // Get data for all registered users
    profiles.forEach((profile) => {
      const userData = getUserData(profile.email);
      if (userData.points > 0) {
        const username = profile.username || profile.email.split("@")[0];
        const userEntry = {
          email: profile.email,
          name: username,
          points: userData.points,
          streak: userData.streak,
        };
        
        // If username already exists, keep the one with higher points
        if (usernameMap.has(username.toLowerCase())) {
          const existing = usernameMap.get(username.toLowerCase());
          if (userEntry.points > existing.points) {
            usernameMap.set(username.toLowerCase(), userEntry);
          }
        } else {
          usernameMap.set(username.toLowerCase(), userEntry);
        }
      }
    });
    
    // Convert map to array and sort by points descending
    const uniqueUsers = Array.from(usernameMap.values());
    return uniqueUsers.sort((a, b) => b.points - a.points);
  } catch {
    return [];
  }
};

/**
 * Get current profile (legacy support)
 * @returns {Object|null} Profile object
 */
export const getProfile = () => {
  try {
    const data = localStorage.getItem(PROFILE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

/**
 * Save current profile (legacy support)
 * @param {Object} profile - Profile object
 */
export const saveProfile = (profile) => {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    // Also save to profiles list
    const profiles = getAllProfiles();
    const existingIndex = profiles.findIndex((p) => p.email === profile.email);
    if (existingIndex >= 0) {
      profiles[existingIndex] = profile;
    } else {
      profiles.push(profile);
    }
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch (err) {
    console.error("Failed to save profile:", err);
  }
};

/**
 * Get all saved profiles
 * @returns {Array} Array of profile objects
 */
export const getAllProfiles = () => {
  try {
    const data = localStorage.getItem(PROFILES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

/**
 * Find profile by email
 * @param {string} email - Email address
 * @returns {Object|null} Profile object or null
 */
export const getProfileByEmail = (email) => {
  const profiles = getAllProfiles();
  return profiles.find((p) => p.email === email) || null;
};

/**
 * Likes storage key
 */
const LIKES_KEY = "zodiacCipherLikes";

/**
 * Get all likes data
 * @returns {Object} Object mapping entryId to array of user emails who liked it
 */
export const getAllLikes = () => {
  try {
    const data = localStorage.getItem(LIKES_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

/**
 * Save likes data
 * @param {Object} likes - Object mapping entryId to array of user emails
 */
export const saveLikes = (likes) => {
  try {
    localStorage.setItem(LIKES_KEY, JSON.stringify(likes));
  } catch (err) {
    console.error("Failed to save likes:", err);
  }
};

/**
 * Toggle like for an entry
 * @param {string} entryId - Unique entry ID (email_date format)
 * @param {string} userEmail - Email of user liking/unliking
 * @returns {Object} Updated likes data
 */
export const toggleLike = (entryId, userEmail) => {
  const likes = getAllLikes();
  if (!likes[entryId]) {
    likes[entryId] = [];
  }
  
  const index = likes[entryId].indexOf(userEmail);
  if (index > -1) {
    // Unlike
    likes[entryId].splice(index, 1);
  } else {
    // Like
    likes[entryId].push(userEmail);
  }
  
  saveLikes(likes);
  return likes;
};

/**
 * Check if user has liked an entry
 * @param {string} entryId - Unique entry ID
 * @param {string} userEmail - User email
 * @returns {boolean} True if user has liked the entry
 */
export const hasUserLiked = (entryId, userEmail) => {
  const likes = getAllLikes();
  return likes[entryId]?.includes(userEmail) || false;
};

/**
 * Get like count for an entry
 * @param {string} entryId - Unique entry ID
 * @returns {number} Number of likes
 */
export const getLikeCount = (entryId) => {
  const likes = getAllLikes();
  return likes[entryId]?.length || 0;
};

/**
 * Get all public journal entries from all users
 * @returns {Array} Array of entries with user info
 */
export const getAllPublicEntries = () => {
  try {
    const profiles = getAllProfiles();
    const allEntries = [];
    
    profiles.forEach((profile) => {
      const userData = getUserData(profile.email);
      const username = profile.username || profile.email.split("@")[0];
      
      // Get entries with images (public entries)
      userData.pastDeeds?.forEach((deed) => {
        if (deed.image) {
          allEntries.push({
            entryId: `${profile.email}_${deed.date}`,
            email: profile.email,
            username: username,
            deed: deed.deed,
            date: deed.date,
            image: deed.image,
            solvePoints: deed.solvePoints || 0,
            uploadPoints: deed.uploadPoints || 0,
            totalPoints: deed.totalPoints || 0,
            streak: deed.streak || 0,
          });
        }
      });
    });
    
    return allEntries;
  } catch {
    return [];
  }
};
