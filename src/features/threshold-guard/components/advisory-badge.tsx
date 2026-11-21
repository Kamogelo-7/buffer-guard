import React from "react";
import { Badge } from "../../../components/ui/badge";
import { Recommendation, RiskSeverity } from "../../../domain/types";

interface AdvisoryBadgeProps {
  recommendation: Recommendation;
  severity: RiskSeverity;
}

export function AdvisoryBadge({ recommendation, severity }: AdvisoryBadgeProps) {
  if (severity === "BLOCK") {
    return <Badge variant="destructive">⛔ BLOCKED (RESERVE RISK)</Badge>;
  }

  switch (recommendation) {
    case "BUY_NOW":
      return <Badge variant="success">✅ BUY NOW</Badge>;
    case "WAIT_FOR_NOVEMBER":
      return <Badge variant="warning">⏳ WAIT FOR NOV (BLACK FRIDAY)</Badge>;
    case "WAIT_FOR_SALE":
      return <Badge variant="warning">🏷️ WAIT FOR SALE</Badge>;
    case "INSUFFICIENT_DATA":
    default:
      return <Badge variant="outline">ℹ️ LOG MORE PRICES</Badge>;
  }
}
