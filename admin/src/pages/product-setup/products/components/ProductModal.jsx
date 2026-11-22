import ProductAddForm from "./ProductAddForm";

export default function ProductModal({ fetchData, viewInStep = false, isDrawer = true }) {
    const closeDrawer = () => {
        document.getElementById("product-drawer").checked = false;
    };

    return (
        <div className="drawer drawer-end">
            <input id="product-drawer" type="checkbox" className="drawer-toggle" />
            <div className="drawer-content"></div>
            <div className="drawer-side h-screen z-50">
                <label htmlFor="product-drawer" className="drawer-overlay"></label>
                <div className="w-1/2 h-full bg-base-100 text-base-content p-6 overflow-y-auto transition-all duration-300">
                    <ProductAddForm
                        fetchData={fetchData}
                        viewInStep={viewInStep}
                        onClose={closeDrawer}
                    />
                </div>
            </div>
        </div>
    );
}