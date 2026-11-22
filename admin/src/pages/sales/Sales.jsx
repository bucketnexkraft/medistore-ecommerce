import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchSales, setSearch, setFilterDate } from "../../slice/saleSlice";
import { Link } from "react-router-dom";
import { FaEdit, FaEllipsisH, FaTrash, FaPlus } from "react-icons/fa";
import Swal from "sweetalert2";
import EditSale from "./UpdateSale";
import axios from "axios";
import { API_URL } from "../../config/constants";
import TableLoading from "./../../components/loadings/TableLoading";
import { MdOutlinePointOfSale } from "react-icons/md";

const Sales = () => {
  const dispatch = useDispatch();
  const { items, status, error, search, filterDate } = useSelector(
    (state) => state.sales
  );
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [selectedSale, setSelectedSale] = useState(null);

  useEffect(() => {
    dispatch(fetchSales({ accessToken, payload: {} }));
  }, [dispatch, accessToken]);

  const filteredItems =
    items?.data?.filter((item) => {
      const matchSearch = item.invoice_no
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchDate = filterDate ? item.date === filterDate : true;
      return matchSearch && matchDate;
    }) || [];

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        const response = await axios.delete(`${API_URL}/sale/delete/${id}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (response.data.status) {
          Swal.fire("Deleted!", "The item has been deleted.", "success");
          dispatch(fetchSales({ accessToken, payload: {} }));
        }
      } catch (error) {
        console.error("Delete error:", error);
        Swal.fire("Error!", "Something went wrong while deleting.", "error");
      }
    }
  };

  if (selectedSale) {
    return (
      <EditSale selectedSale={selectedSale} setSelectedSale={setSelectedSale} />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Sales Table</h2>
        <div className="gap-1 flex">
          <Link to="/new-sale">
            <button className="btn btn-primary">
              <FaPlus className="mr-2" />
              Add New Sale
            </button>
          </Link>
          <Link to="/pos">
            <button className="btn btn-primary text-white">
              <MdOutlinePointOfSale className="mr-2" />
              POS
            </button>
          </Link>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="form-control">
          <input
            type="text"
            placeholder="Search by Invoice No"
            value={search}
            onChange={(e) => dispatch(setSearch(e.target.value))}
            className="input input-bordered w-full"
          />
        </div>
        <div className="form-control">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => dispatch(setFilterDate(e.target.value))}
            className="input input-bordered"
          />
        </div>
      </div>

      {status === "loading" ? (
        <TableLoading />
      ) : status === "failed" ? (
        <div className="alert alert-error shadow-lg">
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current flex-shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Error: {error}</span>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
          <table className="table w-full">
            <thead>
              <tr className="bg-base-200">
                <th className="text-left">Invoice No</th>
                <th className="text-left">Date</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Discount</th>
                <th className="text-right">Tax</th>
                <th className="text-right">Total</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`text-zinc-800 ${index % 2 === 0 ? "bg-zinc-50" : "bg-white"
                      } hover:bg-zinc-200`}
                  >
                    <td>{item.invoice_no}</td>
                    <td>{item.date}</td>
                    <td className="text-right">{item.qty}</td>
                    <td className="text-right">{item.discount}</td>
                    <td className="text-right">{item.tax}</td>
                    <td className="text-right">{item.total}</td>
                    <td className="text-center">
                      <div className="dropdown dropdown-left dropdown-end">
                        <label
                          tabIndex={0}
                          className="btn btn-ghost btn-sm m-1"
                        >
                          <FaEllipsisH />
                        </label>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52"
                        >
                          <li>
                            <button
                              onClick={() => setSelectedSale(item)}
                              className="btn btn-ghost justify-start"
                            >
                              <FaEdit className="mr-2" />
                              Edit
                            </button>
                          </li>
                          <li>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="btn btn-ghost text-error justify-start"
                            >
                              <FaTrash className="mr-2" />
                              Delete
                            </button>
                          </li>
                        </ul>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-8">
                    No sales records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Sales;
