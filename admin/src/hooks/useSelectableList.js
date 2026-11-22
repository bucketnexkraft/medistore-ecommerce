import { useState, useCallback } from "react";

const useSelectableList = (items = [], idKey = "id") => {
  const [selectedOptions, setSelectedOptions] = useState([]);

  // Select or deselect a single item by ID
  const handleSelect = useCallback(
    (itemOrId) => {
      const id =
        typeof itemOrId === "object" && itemOrId !== null
          ? itemOrId[idKey] ?? itemOrId.id
          : itemOrId;

      if (id == null) {
        console.warn("useSelectableList: Invalid item or ID provided to handleSelect");
        return;
      }

      setSelectedOptions((prev) => {
        if (prev.includes(id)) {
          return prev.filter((optionId) => optionId !== id);
        }
        return [...prev, id];
      });
    },
    [idKey]
  );

  // Select or deselect all items on the current page
  const handleSelectAll = useCallback(
    (checked) => {
      if (checked) {
        const validIds = (items || []).reduce((acc, item) => {
          const itemId = item?.[idKey] ?? item?.id;
          if (itemId != null) {
            acc.push(itemId);
          }
          return acc;
        }, []);
        setSelectedOptions(validIds);
      } else {
        setSelectedOptions([]);
      }
    },
    [items, idKey]
  );

  // Check if all items on the current page are selected
  const isAllSelectedOnCurrentPage = useCallback(() => {
    if (!items || items.length === 0) {
      return false;
    }
    return items.every((item) => {
      const itemId = item?.[idKey] ?? item?.id;
      return itemId != null && selectedOptions.includes(itemId);
    });
  }, [items, idKey, selectedOptions]);

  // Clear all selected items
  const clearSelection = useCallback(() => {
    setSelectedOptions([]);
  }, []);

  return {
    selectedOptions,
    handleSelect,
    handleSelectOption: handleSelect,
    handleSelectAll,
    isAllSelectedOnCurrentPage,
    clearSelection,
  };
};

export default useSelectableList;
