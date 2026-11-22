import { store } from "../store/store";

const hasRight = (rightKey) => {
  const rights = store.getState().right.rights || [];


  if (!Array.isArray(rights) || rights.length === 0) {
    return false;
  }

  return rights.some((right) => right.right === rightKey && Number(right.permission) === 1);
};

const isImpersonatedSuperAdmin = () => {
  const auth = store.getState().auth || {};

  return (
    auth?.is_impersonating === true &&
    auth?.impersonator_session?.authSnapshot?.is_super_admin === 1
  );
};

export const PermissionUtils = {
  hasPermission(rightKey) {
    return hasRight(rightKey);
  },

  isAccessable({
    rightKey,
    featureEnabled = true,
    allowImpersonatedSuperAdmin = false,
  } = {}) {
    if (!featureEnabled) {
      return false;
    }

    if (rightKey && hasRight(rightKey)) {
      return true;
    }

    if (allowImpersonatedSuperAdmin && isImpersonatedSuperAdmin()) {
      return true;
    }

    return false;
  },
};

export default PermissionUtils;
