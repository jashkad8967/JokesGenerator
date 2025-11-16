// App.jsx
import React, { useState, useEffect } from "react";

const sentences = [
  "The quick brown fox jumps over the lazy dog",
  "I love programming in JavaScript",
  "OpenAI creates amazing AI models",
  "Today is a beautiful day",
  "Learning is fun and rewarding",
  "Keep pushing your limits",
  "Practice makes perfect",
  "Never give up on your dreams"
];

// Caesar cipher encoding function
const encodeSentence = (sentence) => {
  const shift = Math.floor(Math.random() * 25) + 1; // shift 1-25
  return sentence
    .split("")
    .map((char) => {
      if (/[a-z]/i.test(char)) {
        const code = char.charCodeAt(0);
        const base = code >= 97 ? 97 : 65;
        return String.fromCharCode(((code - base + shift) % 26) + base);
      } else {
        return char;
      }
    })
    .join("");
};

function App() {
  const [selectedSentence, setSelectedSentence] = useState("");
  const [encodedSentence, setEncodedSentence] = useState("");
  const [userInput, setUserInput] = useState("");
  const [message, setMessage] = useState("");
  const [bgColor, setBgColor] = useState("#f0f8ff");

  const colors = [
    "#FFCDD2", "#F8BBD0", "#E1BEE7", "#BBDEFB",
    "#C8E6C9", "#FFF9C4", "#FFECB3", "#D7CCC8"
  ];

  const generatePuzzle = () => {
    const sentence = sentences[Math.floor(Math.random() * sentences.length)];
    setSelectedSentence(sentence);
    setEncodedSentence(encodeSentence(sentence));
    setUserInput("");
    setMessage("");
    const colorIndex = Math.floor(Math.random() * colors.length);
    setBgColor(colors[colorIndex]);
  };

  useEffect(() => {
    generatePuzzle();
  }, []);

  const checkAnswer = () => {
    if (userInput.trim().toLowerCase() === selectedSentence.toLowerCase()) {
      setMessage("✅ Correct! Well done!");
    } else {
      setMessage("❌ Incorrect, try again!");
    }
  };

  return (
    <div style={{
      textAlign: "center",
      padding: "50px",
      minHeight: "100vh",
      backgroundColor: bgColor,
      transition: "background-color 0.5s",
      fontFamily: "Arial, sans-serif"
    }}>
      <h1>🕵️‍♂️ Decode the Sentence!</h1>
      <p style={{ fontSize: "22px", fontWeight: "bold", maxWidth: "600px", margin: "30px auto" }}>
        {encodedSentence}
      </p>

      <input
        type="text"
        value={userInput}
        onChange={(e) => setUserInput(e.target.value)}
        placeholder="Type your decoded sentence here"
        style={{ padding: "10px", fontSize: "18px", width: "60%", marginTop: "10px" }}
      />
      <br />
      <button
        onClick={checkAnswer}
        style={{
          padding: "10px 20px",
          fontSize: "18px",
          cursor: "pointer",
          marginTop: "10px",
          borderRadius: "8px",
          border: "none",
          backgroundColor: "#4CAF50",
          color: "white"
        }}
      >
        Submit
      </button>
      <button
        onClick={generatePuzzle}
        style={{
          padding: "10px 20px",
          fontSize: "18px",
          cursor: "pointer",
          marginTop: "10px",
          marginLeft: "10px",
          borderRadius: "8px",
          border: "none",
          backgroundColor: "#2196F3",
          color: "white"
        }}
      >
        Next Puzzle
      </button>

      {message && (
        <div style={{ marginTop: "20px", fontSize: "20px", color: message.includes("Correct") ? "green" : "red" }}>
          {message}
        </div>
      )}
    </div>
  );
}

export default App;
