import { useState, useEffect } from "react";

const GOOGLE_REVIEW_URL = "https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID";

const starLabels = ["", "Terrible", "Poor", "Okay", "Good", "Excellent"];

export default function SurveyApp() {
  const [step, setStep] = useState("rating"); // rating | feedback | thank-you
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [animateIn, setAnimateIn] = useState(true);

  // Get token from URL params (e.g. ?token=abc123)
  const token = new URLSearchParams(window.location.search).get("token") || "demo";

  const handleStarClick = (val) => {
    setRating(val);
    if (val >= 4) {
      // Positive → redirect to Google after brief moment
      setTimeout(() => {
        window.location.href = GOOGLE_REVIEW_URL;
      }, 800);
    }
  };

  const handleNext = () => {
    if (rating <= 3 && rating > 0) {
      setAnimateIn(false);
      setTimeout(() => {
        setStep("feedback");
        setAnimateIn(true);
      }, 300);
    }
  };

  const handleSubmit = async () => {
    if (!feedback.trim()) return;
    try {
      await fetch("/api/submit-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rating, feedback }),
      });
    } catch (e) {
      // still show thank you
    }
    setAnimateIn(false);
    setTimeout(() => {
      setStep("thank-you");
      setAnimateIn(true);
    }, 300);
  };

  const activeStars = hovered || rating;

  return (
    <div className="root">
      <div className={`card ${animateIn ? "fade-in" : "fade-out"}`}>
        <div className="brand">
          <div className="brand-dot" />
          <span>FeedbackFlow</span>
        </div>

        {step === "rating" && (
          <>
            <div className="headline">How was your experience?</div>
            <p className="sub">We'd love to know how your recent visit went.</p>

            <div className="stars">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  className={`star ${i <= activeStars ? "lit" : ""} ${rating === i ? "selected" : ""}`}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => handleStarClick(i)}
                  aria-label={`${i} star`}
                >
                  ★
                </button>
              ))}
            </div>

            {activeStars > 0 && (
              <div className="star-label">{starLabels[activeStars]}</div>
            )}

            {rating >= 4 && (
              <div className="redirect-notice">
                <div className="spinner" />
                <span>Taking you to Google Reviews…</span>
              </div>
            )}

            {rating > 0 && rating <= 3 && (
              <button className="btn-next" onClick={handleNext}>
                Next →
              </button>
            )}
          </>
        )}

        {step === "feedback" && (
          <>
            <div className="headline">We're sorry to hear that.</div>
            <p className="sub">Help us understand what went wrong — your feedback goes directly to management.</p>

            <div className="rating-badge">
              {"★".repeat(rating)}{"☆".repeat(5 - rating)}
              <span>{starLabels[rating]}</span>
            </div>

            <textarea
              className="feedback-box"
              placeholder="Tell us what happened and how we can improve…"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={5}
            />

            <button
              className="btn-next"
              onClick={handleSubmit}
              disabled={!feedback.trim()}
            >
              Submit Feedback
            </button>
          </>
        )}

        {step === "thank-you" && (
          <>
            <div className="checkmark">✓</div>
            <div className="headline">Thank you.</div>
            <p className="sub">Your feedback has been received and shared with our team. We're committed to doing better.</p>
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        .root {
          min-height: 100vh;
          background: #0f0e0e;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background-image: radial-gradient(ellipse at 20% 50%, rgba(255,200,100,0.06) 0%, transparent 60%),
                            radial-gradient(ellipse at 80% 20%, rgba(255,100,80,0.05) 0%, transparent 50%);
        }

        .card {
          background: #1a1917;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 48px 40px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 40px 80px rgba(0,0,0,0.5);
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-10px); }
        }

        .fade-in { animation: fadeInUp 0.4s ease forwards; }
        .fade-out { animation: fadeOut 0.25s ease forwards; }

        .brand {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 32px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.3);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .brand-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #f5a623;
        }

        .headline {
          font-family: 'DM Serif Display', serif;
          font-size: 28px;
          color: #f5f0e8;
          line-height: 1.2;
          margin-bottom: 10px;
        }

        .sub {
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: rgba(255,255,255,0.4);
          line-height: 1.6;
          margin-bottom: 36px;
        }

        .stars {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .star {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 42px;
          color: rgba(255,255,255,0.12);
          transition: color 0.15s, transform 0.1s;
          line-height: 1;
          padding: 0;
        }

        .star.lit {
          color: #f5a623;
        }

        .star:hover, .star.selected {
          transform: scale(1.15);
        }

        .star-label {
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          color: #f5a623;
          font-weight: 500;
          margin-bottom: 24px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          min-height: 20px;
        }

        .redirect-notice {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          color: rgba(255,255,255,0.4);
          margin-top: 8px;
        }

        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.1);
          border-top-color: #f5a623;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .btn-next {
          margin-top: 8px;
          background: #f5a623;
          color: #0f0e0e;
          border: none;
          border-radius: 10px;
          padding: 14px 28px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          width: 100%;
        }

        .btn-next:hover:not(:disabled) {
          background: #f7b84a;
          transform: translateY(-1px);
        }

        .btn-next:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .rating-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 8px 14px;
          margin-bottom: 20px;
          font-size: 16px;
          color: #f5a623;
          font-family: 'DM Sans', sans-serif;
        }

        .rating-badge span {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .feedback-box {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 16px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #f5f0e8;
          resize: vertical;
          outline: none;
          transition: border-color 0.2s;
          margin-bottom: 20px;
          line-height: 1.6;
        }

        .feedback-box:focus {
          border-color: rgba(245,166,35,0.4);
        }

        .feedback-box::placeholder {
          color: rgba(255,255,255,0.2);
        }

        .checkmark {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(245,166,35,0.1);
          border: 2px solid #f5a623;
          color: #f5a623;
          font-size: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
        }
      `}</style>
    </div>
  );
}
