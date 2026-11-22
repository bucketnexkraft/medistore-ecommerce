import React from "react";
import {
  MdKeyboardDoubleArrowLeft,
  MdKeyboardDoubleArrowRight,
} from "react-icons/md";
import {
  PiCaretDoubleLeftDuotone,
  PiCaretDoubleRightDuotone,
} from "react-icons/pi";

const Pagination = ({
  currentPage,
  lastPage,
  handlePrevious,
  handlePageChange,
  handleNextPage,
}) => {
  // Hide pagination if there's only one page
  if (lastPage <= 1) return null;

  return (
    <div className="flex items-center justify-center md:justify-end py-4 px-4">
      <div className="join">
        {/* Previous Button */}
        <button
          disabled={currentPage === 1}
          onClick={handlePrevious}
          className="join-item btn btn-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <PiCaretDoubleLeftDuotone />
        </button>

        {/* Page Numbers */}
        {Array.from({ length: lastPage }, (_, index) => index + 1).map(
          (page) => {
            // Current page
            if (page === currentPage) {
              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className="join-item btn btn-primary btn-sm text-white font-semibold"
                >
                  {page}
                </button>
              );
            }
            // Show first, last, and pages within ±2 of current page
            if (
              page === 1 ||
              page === lastPage ||
              (page >= currentPage - 2 && page <= currentPage + 2)
            ) {
              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className="join-item btn btn-sm transition-all duration-300"
                >
                  {page}
                </button>
              );
            }
            // Show ellipsis for skipped pages
            if (page === currentPage - 3 || page === currentPage + 3) {
              return (
                <button
                  key={page}
                  disabled
                  className="join-item btn btn-disabled btn-sm text-gray-500"
                >
                  ...
                </button>
              );
            }
            return null;
          }
        )}

        {/* Next Button */}
        <button
          disabled={lastPage === currentPage}
          onClick={handleNextPage}
          className="join-item btn btn-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <PiCaretDoubleRightDuotone />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
