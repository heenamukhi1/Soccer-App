"use client";

import { MessageSquare, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setStatus("idle");
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;

    setStatus("sending");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("app_feedback").insert({
        email: email.trim() || null,
        message: message.trim(),
      });
      if (error) throw error;

      setStatus("success");
      setEmail("");
      setMessage("");
    } catch (error) {
      console.error("[feedback] Could not submit feedback", error);
      setStatus("error");
    }
  }

  function closeFeedback() {
    setIsOpen(false);
    setStatus("idle");
  }

  return (
    <>
      <button className="feedback-button" type="button" onClick={() => setIsOpen(true)}>
        <MessageSquare size={16} aria-hidden="true" />
        <span>Give feedback</span>
      </button>

      {isOpen && (
        <div className="feedback-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeFeedback();
        }}>
          <section className="feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
            <div className="feedback-modal-heading">
              <div>
                <span className="section-kicker">HELP US IMPROVE</span>
                <h2 id="feedback-title">App feedback</h2>
                <p>Tell us what is working well or what we could improve.</p>
              </div>
              <button className="feedback-close" type="button" aria-label="Close feedback form" onClick={closeFeedback}>
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            {status === "success" ? (
              <div className="feedback-success" role="status">
                <span className="feedback-success-icon"><MessageSquare size={20} aria-hidden="true" /></span>
                <h3>Thank you</h3>
                <p>Your feedback has been submitted.</p>
                <button className="feedback-submit" type="button" onClick={closeFeedback}>Done</button>
              </div>
            ) : (
              <form className="feedback-form" onSubmit={submitFeedback}>
                <label>
                  <span>Your email <small>(optional)</small></span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                <label>
                  <span>Feedback <small>(required)</small></span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Tell us what could be better..."
                    rows={6}
                    required
                  />
                </label>
                {status === "error" && (
                  <p className="feedback-error" role="alert">Feedback could not be submitted. Please try again.</p>
                )}
                <button className="feedback-submit" type="submit" disabled={status === "sending" || !message.trim()}>
                  {status === "sending" ? "Sending..." : "Submit feedback"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
