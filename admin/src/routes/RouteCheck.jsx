import UnAuthorized from "../components/common/UnAuthorized";
import { useSelector } from "react-redux";
import Spiner from "../components/loadings/Spiner";
import { useEffect, useState } from "react";
import { getproductSettings } from "../api/productSettings";
import FeatureUpgradePrompt from "../components/subscription/FeatureUpgradePrompt";
import { isFeatureIncludedInPlan } from "../utils/planFeatures";


const RouteCheck = ({ requiredRight, requiredFeature, requiredModuleFeature, requiredCompanySetting, children }) => {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const isSuperAdmin = Number(useSelector((state) => state.auth.is_super_admin) || 0) === 1;
  const selectedPlanFeatures = useSelector((state) => state.auth.selected_plan_features || []);
  const selectedPlan = useSelector((state) => state.auth.selected_plan);
  const rights = useSelector((state) => state.right.rights || []);
  const rightsLoading = useSelector((state) => state.right.loading);
  const { data: companyPreferences } = useSelector((state) => state.preferences);
  const [featureAllowed, setFeatureAllowed] = useState(
    requiredFeature || requiredModuleFeature ? null : true
  );
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [blockedFeature, setBlockedFeature] = useState(null);
  const [rightsWaitExpired, setRightsWaitExpired] = useState(false);

  useEffect(() => {
    if (!rightsLoading) {
      setRightsWaitExpired(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setRightsWaitExpired(true);
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [rightsLoading]);

  useEffect(() => {
    let isMounted = true;

    const checkFeature = async () => {
      const featuresToCheck = [requiredModuleFeature || requiredFeature].filter(Boolean);

      if (featuresToCheck.length === 0 || isSuperAdmin || !accessToken) {
        if (isMounted) {
          setFeatureAllowed(true);
          setUpgradeRequired(false);
          setBlockedFeature(null);
        }
        return;
      }

      const unavailableFeature = featuresToCheck.find(
        (code) => !isFeatureIncludedInPlan(selectedPlanFeatures, code)
      );
      if (unavailableFeature) {
        if (isMounted) {
          setFeatureAllowed(false);
          setUpgradeRequired(true);
          setBlockedFeature(unavailableFeature);
        }
        return;
      }

      try {
        const response = await getproductSettings(accessToken);
        const assignedPreferences = response?.data?.preferences || [];
        const allActive = featuresToCheck.every((code) =>
          assignedPreferences.some((item) => item.code === code && item.is_active)
        );
        if (isMounted) {
          setFeatureAllowed(allActive);
          setUpgradeRequired(false);
          setBlockedFeature(null);
        }
      } catch {
        if (isMounted) {
          setFeatureAllowed(false);
          setUpgradeRequired(false);
        }
      }
    };

    checkFeature();

    return () => {
      isMounted = false;
    };
  }, [requiredFeature, requiredModuleFeature, isSuperAdmin, accessToken, selectedPlanFeatures]);

  if (!requiredRight && !requiredFeature && !requiredModuleFeature && !requiredCompanySetting) {
    return children;
  }

  if (isSuperAdmin) {
    return children;
  }

  if (accessToken && rightsLoading && !rightsWaitExpired) {
    return <Spiner />;
  }

  if ((requiredFeature || requiredModuleFeature) && featureAllowed === null) {
    return <Spiner />;
  }

  const requiredRights = Array.isArray(requiredRight) ? requiredRight : [requiredRight];
  const hasPermission = Array.isArray(rights)
    ? rights.some((right) => requiredRights.includes(right.right) && Number(right.permission) === 1)
    : false;

  if (requiredRight && !hasPermission) {
    return <UnAuthorized />;
  }

  if ((requiredFeature || requiredModuleFeature) && upgradeRequired) {
    return (
      <FeatureUpgradePrompt
        featureCode={blockedFeature || requiredFeature || requiredModuleFeature}
        currentPlanName={selectedPlan?.name || ""}
      />
    );
  }

  if ((requiredFeature || requiredModuleFeature) && !featureAllowed) {
    return <UnAuthorized />;
  }

  const settingLoaded = companyPreferences && !Array.isArray(companyPreferences);
  const companySettingEnabled = ![false, 0, "0", "false"].includes(
    companyPreferences?.[requiredCompanySetting]
  );

  if (requiredCompanySetting && settingLoaded && !companySettingEnabled) {
    return <UnAuthorized />;
  }

  return children;
};

export default RouteCheck;
