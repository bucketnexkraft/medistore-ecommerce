import { Dialog } from "@headlessui/react";
import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import Barcode from "react-barcode";

const BARCODE_FORMATS = [
  { value: "CODE128", label: "CODE128", numericOnly: false },
  { value: "CODE39", label: "CODE39", numericOnly: false },
  { value: "EAN13", label: "EAN13", numericOnly: true, length: 13 },
  { value: "EAN8", label: "EAN8", numericOnly: true, length: 8 },
  { value: "UPC", label: "UPC", numericOnly: true, length: 12 },
  { value: "ITF14", label: "ITF14", numericOnly: true, length: 14 },
];

const DEFAULT_SETTINGS = {
  format: "CODE128",
  labelWidthMm: 38,
  labelHeightMm: 25,
  columns: 5,
  pagePaddingMm: 8,
  gapMm: 3,
  fontSizePx: 11,
  showName: true,
  showCode: true,
};

const validateBarcodeValue = (value, format) => {
  const trimmed = String(value || "").trim();
  const formatConfig = BARCODE_FORMATS.find((item) => item.value === format);

  if (!trimmed) {
    return "Barcode value is empty.";
  }

  if (!formatConfig) {
    return null;
  }

  if (formatConfig.numericOnly && !/^\d+$/.test(trimmed)) {
    return `${format} supports digits only.`;
  }

  if (formatConfig.length && trimmed.length !== formatConfig.length) {
    return `${format} requires exactly ${formatConfig.length} digits.`;
  }

  return null;
};

const PrintableBarcodeSheet = ({ open, onClose, products }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSettings(DEFAULT_SETTINGS);
    setItems(
      products.map((product) => ({
        id: product.id,
        name: product.name || "Unnamed Product",
        code: product.code || "",
        quantity: 1,
      }))
    );
  }, [open, products]);

  const labels = useMemo(
    () =>
      items.flatMap((item) => {
        const qty = Math.max(0, Number(item.quantity) || 0);

        return Array.from({ length: qty }, (_, index) => ({
          key: `${item.id}-${index}`,
          name: item.name,
          code: item.code,
        }));
      }),
    [items]
  );

  const invalidItems = useMemo(
    () =>
      items
        .map((item) => ({
          ...item,
          error: validateBarcodeValue(item.code, settings.format),
        }))
        .filter((item) => item.error),
    [items, settings.format]
  );

  const handlePrint = () => {
    window.print();
  };

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <style>{`
        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          body > *:not(#headlessui-portal-root) {
            display: none !important;
          }

          #headlessui-portal-root {
            display: block !important;
          }

          #headlessui-portal-root * {
            visibility: hidden !important;
          }

          #headlessui-portal-root .barcode-sheet-print-wrapper,
          #headlessui-portal-root .barcode-sheet-print-wrapper * {
            visibility: visible !important;
          }

          .no-print {
            display: none !important;
          }

          .barcode-sheet-print-wrapper {
            position: static !important;
            inset: auto !important;
            z-index: auto !important;
            background: #fff !important;
            padding: 0 !important;
            display: block !important;
            overflow: visible !important;
            height: auto !important;
          }

          .barcode-sheet-print-panel {
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }

          .barcode-label {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          @page {
            size: A4 portrait;
            margin: ${settings.pagePaddingMm}mm;
          }
        }
      `}</style>

      <div className="fixed inset-0 bg-black/30 no-print" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center p-4 pt-8 barcode-sheet-print-wrapper">
        <Dialog.Panel className="w-full max-w-7xl bg-white rounded-xl overflow-y-auto max-h-[92vh] barcode-sheet-print-panel">
          <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-5 no-print">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Print Barcode Sheet
                </h2>
                <p className="text-sm text-gray-500">
                  Configure the label size and quantity, then print on A4 paper.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <label className="form-control">
                  <span className="label-text mb-1">Format</span>
                  <select
                    className="select select-bordered"
                    value={settings.format}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        format: event.target.value,
                      }))
                    }
                  >
                    {BARCODE_FORMATS.map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-control">
                  <span className="label-text mb-1">Label Width (mm)</span>
                  <input
                    type="number"
                    min="20"
                    max="100"
                    className="input input-bordered"
                    value={settings.labelWidthMm}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        labelWidthMm: Number(event.target.value) || 0,
                      }))
                    }
                  />
                </label>

                <label className="form-control">
                  <span className="label-text mb-1">Label Height (mm)</span>
                  <input
                    type="number"
                    min="15"
                    max="80"
                    className="input input-bordered"
                    value={settings.labelHeightMm}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        labelHeightMm: Number(event.target.value) || 0,
                      }))
                    }
                  />
                </label>

                <label className="form-control">
                  <span className="label-text mb-1">Columns</span>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    className="input input-bordered"
                    value={settings.columns}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        columns: Number(event.target.value) || 1,
                      }))
                    }
                  />
                </label>

                <label className="form-control">
                  <span className="label-text mb-1">Page Padding (mm)</span>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    className="input input-bordered"
                    value={settings.pagePaddingMm}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        pagePaddingMm: Number(event.target.value) || 0,
                      }))
                    }
                  />
                </label>

                <label className="form-control">
                  <span className="label-text mb-1">Gap (mm)</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    className="input input-bordered"
                    value={settings.gapMm}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        gapMm: Number(event.target.value) || 0,
                      }))
                    }
                  />
                </label>

                <label className="form-control">
                  <span className="label-text mb-1">Text Size (px)</span>
                  <input
                    type="number"
                    min="8"
                    max="16"
                    className="input input-bordered"
                    value={settings.fontSizePx}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        fontSizePx: Number(event.target.value) || 10,
                      }))
                    }
                  />
                </label>

                <div className="flex flex-col justify-end gap-2">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={settings.showName}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          showName: event.target.checked,
                        }))
                      }
                    />
                    <span className="label-text">Show product name</span>
                  </label>
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={settings.showCode}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          showCode: event.target.checked,
                        }))
                      }
                    />
                    <span className="label-text">Show barcode text</span>
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto border rounded-xl">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Barcode</th>
                      <th className="w-32">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const error = validateBarcodeValue(item.code, settings.format);

                      return (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>
                            <div className="flex flex-col gap-1">
                              <input
                                type="text"
                                className={`input input-bordered input-sm w-full ${
                                  error ? "input-error" : ""
                                }`}
                                value={item.code}
                                onChange={(event) =>
                                  updateItem(item.id, "code", event.target.value)
                                }
                              />
                              {error && (
                                <span className="text-xs text-error">{error}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              className="input input-bordered input-sm w-full"
                              value={item.quantity}
                              onChange={(event) =>
                                updateItem(item.id, "quantity", event.target.value)
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">
                    Total labels:
                  </span>{" "}
                  {labels.length}
                </div>
                {invalidItems.length > 0 && (
                  <div className="text-sm text-error">
                    Fix invalid barcode values before printing.
                  </div>
                )}
              </div>
            </div>

            <div
              className="bg-white"
              style={{
                width: "210mm",
                minHeight: "297mm",
                padding: 0,
                margin: "0 auto",
                boxSizing: "border-box",
              }}
            >
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(
                    1,
                    Number(settings.columns) || 1
                  )}, ${settings.labelWidthMm}mm)`,
                  gap: `${settings.gapMm}mm`,
                  justifyContent: "start",
                }}
              >
                {labels.map((label) => (
                  <div
                    key={label.key}
                    className="barcode-label border border-gray-200 rounded-md flex flex-col items-center justify-center text-center overflow-hidden"
                    style={{
                      width: `${settings.labelWidthMm}mm`,
                      height: `${settings.labelHeightMm}mm`,
                      padding: "1.5mm",
                    }}
                  >
                    {settings.showName && (
                      <div
                        className="font-semibold text-gray-900 leading-tight mb-1"
                        style={{ fontSize: `${settings.fontSizePx}px` }}
                      >
                        {label.name}
                      </div>
                    )}
                    <Barcode
                      value={label.code}
                      format={settings.format}
                      width={1}
                      height={Math.max(
                        20,
                        Math.round(settings.labelHeightMm * 2.1)
                      )}
                      margin={0}
                      displayValue={settings.showCode}
                      fontSize={Math.max(8, settings.fontSizePx - 1)}
                      background="#ffffff"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="no-print sticky bottom-0 bg-white border-t border-gray-200 pt-4 mt-6 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={onClose}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={handlePrint}
                disabled={labels.length === 0 || invalidItems.length > 0}
              >
                Print
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

PrintableBarcodeSheet.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  products: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string,
      code: PropTypes.string,
    })
  ).isRequired,
};

export default PrintableBarcodeSheet;
