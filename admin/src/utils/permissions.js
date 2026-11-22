import { PermissionUtils } from "./permissionUtils";

export const hasPermission = (rightKey) => {
  return PermissionUtils.hasPermission(rightKey);
};
