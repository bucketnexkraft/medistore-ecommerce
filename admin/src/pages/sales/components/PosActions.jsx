import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import PrintableSaleReceipt from "../../../components/printable-invoices/PrintableSaleReceipt";
import PosPrinterReceipt from "../../../components/printable-invoices/PosPrinterReceipt";
import { hasPermission } from "../../../utils/permissions";
import { PermissionUtils } from "../../../utils/permissionUtils";
import ShiftButtons from "./ShiftButtons";
import { getproductSettings } from "../../../api/productSettings";
import { getCurrentShift } from "../../../api/timesheet";

const PosActions = ({
  confirmSale,
  isConfirmingSale,
  saveDraft,
  cancelSale,
  setShowDraftList,
  printInvoice,
  printWithCustomerInfo,
  setPrintInvoice,
  printerType,
  setPrinterType,
  companyInfo,
  printDraftData,
  setPrintDraftData,
}) => {
  const [shiftData, setShiftData] = useState(false);
  const [isShiftFeatureEnabled, setIsShiftFeatureEnabled] = useState(false);
  const accessToken = useSelector((state) => state.auth.accessToken);
  const userId = useSelector((state) => state.auth.user?.id);
  const canCreateSale = hasPermission("stock-out.create");
  const canViewAnyDraft = hasPermission("invoice.sale.draft.finalize.any");
  const canViewDraftList = canCreateSale || canViewAnyDraft;
  const requiresShifting = PermissionUtils.hasPermission("stock-out.shifting") && isShiftFeatureEnabled;
  const canProceedWithSales = !requiresShifting || shiftData;
  const shiftCacheKey = userId ? `pos_active_shift_${userId}` : null;

  const syncCurrentShift = useCallback(async () => {
    if (!requiresShifting || !accessToken) return;
    try {
      const res = await getCurrentShift(accessToken);
      const shift = res?.data?.id ? res.data : res;
      const isActive = !!shift?.id;
      setShiftData(isActive);
      if (shiftCacheKey) {
        localStorage.setItem(shiftCacheKey, isActive ? "1" : "0");
      }
    } catch (error) {
      if (error?.response?.status === 404) {
        setShiftData(false);
        if (shiftCacheKey) {
          localStorage.setItem(shiftCacheKey, "0");
        }
        return;
      }

      // Keep last known state on transient errors
      if (shiftCacheKey) {
        const cached = localStorage.getItem(shiftCacheKey);
        if (cached === "1") {
          setShiftData(true);
        }
      }
    }
  }, [requiresShifting, accessToken, shiftCacheKey]);

  useEffect(() => {
    let isMounted = true;

    const loadShiftFeature = async () => {
      if (!accessToken) {
        if (isMounted) {
          setIsShiftFeatureEnabled(false);
        }
        return;
      }

      try {
        const result = await getproductSettings(accessToken);
        const assignedPreferences = result?.data?.preferences || [];
        const shiftPreference = assignedPreferences.find(
          (preference) => preference.code === "ftr_shift_and_cash_handover"
        );
        if (isMounted) {
          setIsShiftFeatureEnabled(!!shiftPreference?.is_active);
        }
      } catch (error) {
        if (isMounted) {
          setIsShiftFeatureEnabled(false);
        }
      }
    };

    loadShiftFeature();

    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!requiresShifting) {
      return;
    }

    if (shiftCacheKey) {
      const cached = localStorage.getItem(shiftCacheKey);
      if (cached === "1") {
        setShiftData(true);
      }
    }

    syncCurrentShift();

    const handleFocus = () => {
      syncCurrentShift();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [requiresShifting, shiftCacheKey, syncCurrentShift]);

  return (
    <div className="space-y-2 mt-4">
      <>
        {canCreateSale && (
          <button
            onClick={confirmSale}
            className="btn btn-lg w-full bg-indigo-600 text-white hover:bg-indigo-500 transition-colors duration-200"
            tabIndex={109}
            disabled={isConfirmingSale || !canProceedWithSales}
          >
            {isConfirmingSale ? (
              <svg
                className="animate-spin h-5 w-5 text-white inline-block"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2V6M12 18V22M6 12H2M22 12H18M18.364 5.636L15.536 8.464M8.464 15.536L5.636 18.364M18.364 18.364L15.536 15.536M8.464 8.464L5.636 5.636"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              "Confirm (Ctrl+S)"
            )}
          </button>
        )}
        <div className="flex gap-2 items-center">
          {canCreateSale && (
            <button
              onClick={saveDraft}
              className="flex-1 btn btn-lg px-4 text-sm bg-yellow-400 text-white hover:bg-yellow-500 transition-colors duration-200"
              tabIndex={110}
              disabled={isConfirmingSale || !canProceedWithSales}
            >
              Draft (Ctrl+D)
            </button>
          )}
          {canCreateSale && (
            <button
              onClick={cancelSale}
              className="flex-1 btn btn-lg px-4 text-sm bg-red-600 text-white hover:bg-red-500 transition-colors duration-200"
              tabIndex={111}
              disabled={isConfirmingSale || !canProceedWithSales}
            >
              Cancel (Ctrl+C)
            </button>
          )}
          {canViewDraftList && (
            <button
              onClick={() => setShowDraftList(true)}
              className="flex-1 btn btn-lg px-4 text-sm btn-info text-white hover:bg-blue-500 transition-colors duration-200"
              tabIndex={4}
            >
              Draft List (Ctrl+L)
            </button>
          )}
          {printDraftData && (
            <button
              onClick={() => {
                setPrinterType(printerType);
                setPrintDraftData(printDraftData);
              }}
              className="flex-1 btn btn-lg px-4 text-sm bg-purple-600 text-white hover:bg-purple-700 transition-colors duration-200"
              tabIndex={5}
            >
              Print Draft
            </button>
          )}
        </div>
        {!canProceedWithSales && (
          <div className="text-xs text-amber-600 font-medium px-1">
            Start shift first to enable Confirm/Draft/Cancel.
          </div>
        )}
      </>
      {/* ==== NEW SHIFT BUTTONS ==== */}
      {requiresShifting && <ShiftButtons setShiftData={setShiftData} hideTrigger={true} />}
      
      {printInvoice && printerType === 'normal' && (
        <PrintableSaleReceipt
          invoice={printInvoice}
          withCustomerInfo={printWithCustomerInfo}
          onClose={() => setPrintInvoice(null)}
          companyInfo={companyInfo}
        />
      )}
      
      {printInvoice && printerType === 'pos' && (
        <PosPrinterReceipt
          invoice={printInvoice}
          withCustomerInfo={printWithCustomerInfo}
          onClose={() => setPrintInvoice(null)}
          companyInfo={companyInfo}
        />
      )}

      {printDraftData && printerType === 'normal' && (
        <PrintableSaleReceipt
          invoice={printDraftData}
          withCustomerInfo={printDraftData.customer}
          onClose={() => setPrintDraftData(null)}
          companyInfo={companyInfo}
          isDraft={true}
        />
      )}
      
      {printDraftData && printerType === 'pos' && (
        <PosPrinterReceipt
          invoice={printDraftData}
          withCustomerInfo={printDraftData.customer}
          onClose={() => setPrintDraftData(null)}
          companyInfo={companyInfo}
          isDraft={true}
        />
      )}
    </div>
  );
};

export default PosActions;
