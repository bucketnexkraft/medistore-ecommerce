
import React from 'react';
import { BsX } from 'react-icons/bs';
import { MdOutlineRestorePage } from 'react-icons/md';
import { PiEye, PiTrash } from 'react-icons/pi';

const isRealDraftProduct = (product) =>
  Boolean(
    product?.product_id &&
    product?.inventory_id &&
    Number(product?.quantity || 0) !== 0
  );

const DraftsListDrawer = ({
  showDraftList,
  setShowDraftList,
  drafts,
  printDraft,
  restoreDraft,
  deleteDraft,
}) => {
  if (!showDraftList) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={() => setShowDraftList(false)}
      />
       <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out translate-x-0 flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-lg font-bold">Drafts List</h3>
          <button
            onClick={() => setShowDraftList(false)}
            className="text-gray-600 hover:text-gray-800 transition-colors duration-200"
          >
            <BsX className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto scrollbar-thin flex-1">
          {drafts.length === 0 ? (
            <p className="text-sm text-gray-500">No drafts available</p>
          ) : (
            drafts.map((draft, index) => (
              <div key={draft.id} className="border-b border-gray-200 pb-2">
                <div className="flex justify-between items-center">
                  <div className="flex gap-3">
                    <div className="text-sm font-semibold text-gray-500">
                      {index + 1}.
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {draft.customerName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(draft.timestamp).toLocaleString()}
                      </p>
                      <p className="text-xs">
                        Items:{" "}
                        {draft.products.filter(isRealDraftProduct).length}
                      </p>
                      <p className="text-xs">
                        Total: ${draft.saleSummary.grandTotal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => printDraft(draft)}
                      className="bg-indigo-500 text-white px-2 py-1 rounded-lg text-sm hover:bg-blue-600 transition-colors duration-200"
                    >
                      <PiEye fontSize={16} />
                    </button>
                    <button
                      onClick={() => restoreDraft(draft.id)}
                      className="bg-blue-500 text-white px-2 py-1 rounded-lg text-sm hover:bg-blue-600 transition-colors duration-200"
                    >
                      <MdOutlineRestorePage fontSize={16} />
                    </button>
                    <button
                      onClick={() => deleteDraft(draft.id)}
                      className="bg-red-500 text-white px-2 py-1 rounded-lg text-sm hover:bg-red-600 transition-colors duration-200"
                    >
                      <PiTrash fontSize={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default DraftsListDrawer;
