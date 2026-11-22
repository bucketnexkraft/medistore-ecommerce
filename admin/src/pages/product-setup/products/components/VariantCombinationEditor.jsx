import { FaPlus, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import { getVariantAttributes } from "../../../../api/products";

const emptyDimension = () => ({ variant: null, options: [] });
const emptyCombination = () => ({ values: {}, quantity: "", selling_price: "" });

const combinationKey = (values = {}) => JSON.stringify(
    Object.fromEntries(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)))
);

export default function VariantCombinationEditor({
    variantList = [],
    accessToken,
    dimensions,
    combinations,
    onChange,
    disabled = false,
    showPricing = true,
}) {
    const update = (nextDimensions = dimensions, nextCombinations = combinations) =>
        onChange({ dimensions: nextDimensions, combinations: nextCombinations });

    const selectDimension = async (index, variantId) => {
        const variant = variantList.find((item) => String(item.id) === String(variantId));
        const nextDimensions = [...dimensions];
        nextDimensions[index] = { variant: variant || null, options: [] };
        const nextCombinations = combinations.map((combination) => {
            const values = { ...combination.values };
            if (dimensions[index]?.variant?.name) delete values[dimensions[index].variant.name.toLowerCase()];
            return { ...combination, values };
        });

        if (variant) {
            const response = await getVariantAttributes(accessToken, { variant_id: variant.id });
            nextDimensions[index].options = response.status ? response.data || [] : [];
        }

        update(nextDimensions, nextCombinations);
    };

    const selectValue = (combinationIndex, dimension, valueId) => {
        const option = dimension.options.find((item) => String(item.id) === String(valueId));
        const values = { ...combinations[combinationIndex].values };
        const key = dimension.variant.name.toLowerCase();
        if (option) values[key] = option.attribute_value;
        else delete values[key];

        const isComplete = dimensions.every((item) => values[item.variant?.name?.toLowerCase()]);
        if (isComplete) {
            const key = combinationKey(values);
            const duplicate = combinations.some((combination, index) =>
                index !== combinationIndex && combinationKey(combination.values) === key
            );
            if (duplicate) {
                toast.error("This combination is already added.");
                return;
            }
        }

        const nextCombinations = [...combinations];
        nextCombinations[combinationIndex] = { ...nextCombinations[combinationIndex], values };
        update(dimensions, nextCombinations);
    };

    const updateCombination = (index, field, value) => {
        const nextCombinations = [...combinations];
        nextCombinations[index] = { ...nextCombinations[index], [field]: value };
        update(dimensions, nextCombinations);
    };

    const addDimension = () => update([...dimensions, emptyDimension()], combinations);

    const removeDimension = (index) => {
        const removedKey = dimensions[index]?.variant?.name?.toLowerCase();
        const nextDimensions = dimensions.filter((_, itemIndex) => itemIndex !== index);
        const nextCombinations = combinations.map((combination) => {
            const values = { ...combination.values };
            if (removedKey) delete values[removedKey];
            return { ...combination, values };
        });
        update(nextDimensions, nextCombinations);
    };

    const addCombination = () => update(dimensions, [...combinations, emptyCombination()]);

    const removeCombination = (index) => {
        if (combinations.length <= 1) return;
        update(dimensions, combinations.filter((_, itemIndex) => itemIndex !== index));
    };

    const selectedVariantIds = dimensions
        .map((dimension) => dimension.variant?.id)
        .filter(Boolean)
        .map(String);

    return (
        <div className="space-y-5">
            <div>
                <div className="mb-2 flex items-center justify-between">
                    <div>
                        <p className="font-medium">Variant types</p>
                        <p className="text-sm text-base-content/70">Choose the attributes used in each combination.</p>
                    </div>
                    <button type="button" className="btn btn-sm btn-outline" onClick={addDimension} disabled={disabled}>
                        <FaPlus /> Add type
                    </button>
                </div>
                <div className="space-y-2">
                    {dimensions.map((dimension, index) => (
                        <div key={index} className="grid grid-cols-[1fr_auto] gap-2">
                            <select
                                className="select select-bordered w-full"
                                value={dimension.variant?.id || ""}
                                disabled={disabled}
                                onChange={(event) => selectDimension(index, event.target.value)}
                            >
                                <option value="">Select variant type</option>
                                {variantList.map((variant) => (
                                    <option
                                        key={variant.id}
                                        value={variant.id}
                                        disabled={selectedVariantIds.includes(String(variant.id)) && String(variant.id) !== String(dimension.variant?.id)}
                                    >
                                        {variant.name}
                                    </option>
                                ))}
                            </select>
                            <button type="button" className="btn btn-sm btn-circle btn-error" onClick={() => removeDimension(index)} disabled={disabled || dimensions.length <= 1}>
                                <FaTrash />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <div className="mb-2 flex items-center justify-between">
                    <div>
                        <p className="font-medium">Combinations</p>
                        <p className="text-sm text-base-content/70">Each row is one sellable product combination.</p>
                    </div>
                    <button type="button" className="btn btn-sm btn-primary" onClick={addCombination} disabled={disabled || dimensions.some((dimension) => !dimension.variant)}>
                        <FaPlus /> Add combination
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full table-auto">
                        <thead>
                            <tr className="text-left">
                                {dimensions.map((dimension, index) => (
                                    <th key={index} className="px-1 py-2">{dimension.variant?.name || "Variant"}</th>
                                ))}
                                {showPricing && <><th className="px-1 py-2">Quantity</th><th className="px-1 py-2">Selling price</th></>}
                                <th className="px-1 py-2 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {combinations.map((combination, combinationIndex) => (
                                <tr key={`${combinationIndex}-${combinationKey(combination.values)}`}>
                                    {dimensions.map((dimension, dimensionIndex) => {
                                        const key = dimension.variant?.name?.toLowerCase();
                                        const currentValue = combination.values?.[key] || "";
                                        const selectedOption = dimension.options.find((option) =>
                                            String(option.attribute_value).trim().toLowerCase() === String(currentValue).trim().toLowerCase()
                                        );
                                        return (
                                            <td key={dimensionIndex} className="px-1 py-2">
                                                <select
                                                    className="select select-bordered w-full"
                                                    value={selectedOption?.id || ""}
                                                    disabled={disabled || !dimension.variant}
                                                    onChange={(event) => selectValue(combinationIndex, dimension, event.target.value)}
                                                >
                                                    <option value="">Select value</option>
                                                    {dimension.options.map((option) => <option key={option.id} value={option.id}>{option.attribute_value}</option>)}
                                                </select>
                                            </td>
                                        );
                                    })}
                                    {showPricing && <>
                                        <td className="px-1 py-2"><input type="number" min="0" step="0.01" className="input input-bordered w-full" placeholder="Quantity" disabled={disabled} value={combination.quantity ?? ""} onChange={(event) => updateCombination(combinationIndex, "quantity", event.target.value)} /></td>
                                        <td className="px-1 py-2"><input type="number" min="0" step="0.01" className="input input-bordered w-full" placeholder="Selling price" disabled={disabled} value={combination.selling_price ?? ""} onChange={(event) => updateCombination(combinationIndex, "selling_price", event.target.value)} /></td>
                                    </>}
                                    <td className="px-1 py-2 text-right"><button type="button" className="btn btn-sm btn-circle btn-error" onClick={() => removeCombination(combinationIndex)} disabled={disabled || combinations.length <= 1}><FaTrash /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
