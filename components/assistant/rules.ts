import { AssistantInput, AssistantResult } from "./types";

export function getAssistantAdvice(input: AssistantInput): AssistantResult {
  const days = input.daysSinceReply ?? 0;

  switch (input.scenario) {
    case "no_reply": {
      if (days < 1) {
        return {
          verdict: "Too early to worry",
          risk: "low",
          summary: "A short reply delay usually does not tell you much yet.",
          reasoning: [
            "Less than 24 hours has passed",
            "Reply timing alone is weak evidence this early",
          ],
          nextStep: "Wait before sending another message.",
          avoid: "Do not send multiple follow-ups out of anxiety.",
        };
      }

      if (days >= 1 && days <= 3 && input.repeatPattern) {
        return {
          verdict: "Pattern worth noticing",
          risk: "caution",
          summary: "A repeated slow-reply pattern can suggest low consistency.",
          reasoning: [
            "More than a day has passed",
            "This has happened before",
          ],
          nextStep: "Match their energy and let them show effort.",
          avoid: "Do not over-invest in someone giving mixed effort.",
        };
      }

      if (days >= 4) {
        return {
          verdict: "Likely disengagement",
          risk: "high",
          summary: "A long silence often points to low intent unless there is a clear reason.",
          reasoning: [
            "Several days have passed without a reply",
            input.gaveReason
              ? "There was a reason given, but the silence is still long"
              : "No clear explanation was given",
          ],
          nextStep: "Pull back and wait for clear effort from them.",
          avoid: "Do not chase closure from silence.",
        };
      }

      return {
        verdict: "Unclear but watch the pattern",
        risk: "caution",
        summary: "There is not enough here yet to call it strongly either way.",
        reasoning: [
          "Some delay is present",
          "The pattern is not strong enough yet",
        ],
        nextStep: "Give it a bit more time and watch actions, not assumptions.",
        avoid: "Do not jump to the worst conclusion too quickly.",
      };
    }

    case "mixed_signals": {
      if (input.madeRealPlans) {
        return {
          verdict: "Interest may be real but inconsistent",
          risk: "caution",
          summary: "There may be genuine interest, but the consistency is weak.",
          reasoning: [
            "Signals are mixed",
            "There is some real-world effort",
          ],
          nextStep: "Look for steady behaviour over time, not one good moment.",
          avoid: "Do not let chemistry excuse inconsistency.",
        };
      }

      return {
        verdict: "Likely low clarity or low intent",
        risk: "high",
        summary: "Mixed signals without meaningful effort usually lead to confusion, not progress.",
        reasoning: [
          "Their behaviour is inconsistent",
          "There is no strong action backing up their words",
        ],
        nextStep: "Step back and require clearer effort before investing more.",
        avoid: "Do not try to decode every small signal.",
      };
    }

    case "cancelled_plans": {
      if (input.gaveReason && input.madeRealPlans) {
        return {
          verdict: "Could be genuine, but verify with follow-through",
          risk: "caution",
          summary: "A cancellation with a reason matters less if they actively reschedule.",
          reasoning: [
            "They gave an explanation",
            "There is still some effort to see you",
          ],
          nextStep: "Watch whether they follow through on the new plan.",
          avoid: "Do not keep making all the effort yourself.",
        };
      }

      return {
        verdict: "Low reliability",
        risk: "high",
        summary: "Cancelled plans without clear effort to make it right are a bad sign.",
        reasoning: [
          input.gaveReason
            ? "A reason was given, but effort still looks weak"
            : "No proper explanation was given",
          "Reliability is shown by rescheduling, not words alone",
        ],
        nextStep: "Stop carrying the planning and let them show intent.",
        avoid: "Do not reward flaky behaviour with more effort.",
      };
    }

    case "breadcrumbing": {
      return {
        verdict: "Breadcrumbing likely",
        risk: "high",
        summary: "This looks like intermittent attention without real investment.",
        reasoning: [
          "Attention is inconsistent",
          "There is contact, but not meaningful progress",
        ],
        nextStep: "Judge them by steady effort, not occasional pings.",
        avoid: "Do not confuse access with genuine intention.",
      };
    }

    case "late_night_only": {
      if (input.onlyLateNight) {
        return {
          verdict: "Possibly convenience-based attention",
          risk: "high",
          summary: "Late-night-only contact often points to low seriousness.",
          reasoning: [
            "The timing pattern is narrow",
            "Contact seems to happen when it suits them most",
          ],
          nextStep: "Set a higher standard for when and how they show up.",
          avoid: "Do not treat late-night attention as full interest.",
        };
      }

      return {
        verdict: "Timing may be a clue, but not enough on its own",
        risk: "caution",
        summary: "A timing pattern matters more when paired with low effort elsewhere.",
        reasoning: [
          "Late communication can mean different things",
          "You need the wider behaviour pattern too",
        ],
        nextStep: "Look at consistency, planning, and effort as a whole.",
        avoid: "Do not judge from one factor alone.",
      };
    }

    case "ghost_return": {
      return {
        verdict: "Re-entry without accountability",
        risk: "high",
        summary: "Coming back after disappearing can signal inconsistency unless behaviour changes clearly.",
        reasoning: [
          "They withdrew contact before",
          "Returning alone is not the same as improved effort",
        ],
        nextStep: "Require consistency before giving renewed access.",
        avoid: "Do not act like the disappearance never happened.",
      };
    }

    case "love_bombing": {
      return {
        verdict: "Possible love bombing",
        risk: "high",
        summary: "Very intense attention early on can feel flattering but may not be stable.",
        reasoning: [
          "The emotional pace is very fast",
          "Intensity is not the same as grounded intention",
        ],
        nextStep: "Slow the pace down and look for stable behaviour over time.",
        avoid: "Do not trust intensity more than consistency.",
      };
    }

    case "inconsistent_effort": {
      if (input.madeRealPlans && input.repeatPattern) {
        return {
          verdict: "Unreliable effort pattern",
          risk: "caution",
          summary: "There may be some interest, but the inconsistency will create confusion.",
          reasoning: [
            "Some effort exists",
            "The pattern is still unstable",
          ],
          nextStep: "Lower your investment until their effort becomes consistent.",
          avoid: "Do not fill the gaps with hope.",
        };
      }

      return {
        verdict: "Low effort",
        risk: "high",
        summary: "When effort is inconsistent, the safest reading is to trust the inconsistency.",
        reasoning: [
          "Their actions are not steady",
          "You are left doing too much of the emotional work",
        ],
        nextStep: "Step back and let their consistency prove itself.",
        avoid: "Do not keep carrying the connection alone.",
      };
    }

    default: {
      return {
        verdict: "Not enough information yet",
        risk: "caution",
        summary: "The situation needs a little more context.",
        reasoning: ["The current answers do not strongly match one pattern yet."],
        nextStep: "Add one or two more details and review the pattern again.",
        avoid: "Do not rush into a firm conclusion.",
      };
    }
  }
}