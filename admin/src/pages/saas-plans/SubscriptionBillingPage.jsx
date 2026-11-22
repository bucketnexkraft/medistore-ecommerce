import { useSelector } from "react-redux";
import PlanPayments from "./PlanPayments";
import CommissionBilling from "./CommissionBilling";

export default function SubscriptionBillingPage() {
  const selectedPlan = useSelector((state) => state.auth.selected_plan);

  if (selectedPlan?.plan_type === "commission") {
    return <CommissionBilling />;
  }

  return <PlanPayments />;
}
