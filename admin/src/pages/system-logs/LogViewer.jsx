import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import {
    MdOutlineFilePresent,
    MdDownload,
    MdDelete,
    MdSearch,
    MdRefresh,
    MdFolder,
    MdError,
} from "react-icons/md";

// Import your API functions
import {
    fetchLogFiles,
    fetchLogEntries,
    downloadLogFile,
    deleteLogFile,
} from "../../api/logs"; // Adjust the path accordingly
import Swal from "sweetalert2";

const LogViewer = () => {
    const accessToken = useSelector((state) => state.auth.accessToken);

    const [loading, setLoading] = useState(true);
    const [logFiles, setLogFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [logEntries, setLogEntries] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedLevel, setSelectedLevel] = useState("");
    const [lines, setLines] = useState(100);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loadingEntries, setLoadingEntries] = useState(false);
    const [error, setError] = useState("");

    const loadLogFiles = async () => {
        try {
            setLoading(true);
            setError("");
            const result = await fetchLogFiles(accessToken);
            setLogFiles(result.data || []); // assuming your API returns { status: true, data: [...] }
        } catch (err) {
            setError("Failed to fetch log files");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadLogEntries = async (filename) => {
        try {
            setLoadingEntries(true);
            setError("");
            const params = {
                lines,
                search: searchTerm || undefined,
                level: selectedLevel || undefined,
            };

            const result = await fetchLogEntries(accessToken, filename, params);
            setLogEntries(result.data?.entries || []);
        } catch (err) {
            setError("Failed to fetch log entries");
            console.error(err);
        } finally {
            setLoadingEntries(false);
        }
    };

    const handleDownload = async (filename) => {
        try {
            setError("");
            const result = await downloadLogFile(accessToken, filename);
            if (!result.status) {
                setError(result.message || "Failed to download log file");
            }
            // Success: download is handled inside the service
        } catch (err) {
            setError("Failed to download log file");
            console.error(err);
        }
    };

    const handleDelete = async (filename) => {
        const result = await Swal.fire({
            title: "Delete log file?",
            text: "This action cannot be undone.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Delete",
            cancelButtonText: "Cancel",
        });

        if (!result.isConfirmed) return;

        try {
            setError("");
            const deleteResult = await deleteLogFile(accessToken, filename);

            if (deleteResult.status) {
                await loadLogFiles(); // Refresh list
                if (selectedFile === filename) {
                    setSelectedFile(null);
                    setLogEntries([]);
                }
            } else {
                setError(deleteResult.message || "Failed to delete log file");
            }
        } catch (err) {
            setError("Failed to delete log file");
            console.error(err);
        }
    };

    useEffect(() => {
        loadLogFiles();
    }, []);

    useEffect(() => {
        if (selectedFile) {
            loadLogEntries(selectedFile);
        }
    }, [selectedFile, lines, searchTerm, selectedLevel]);

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-2xl font-bold">System Logs</h1>
                    <p className="text-sm text-gray-600">
                        You can find all system error, warning, denugs etc from here.
                    </p>
                </div>
                <button
                    onClick={loadLogFiles}
                    className="btn btn-outline btn-primary btn-sm"
                    disabled={loading}
                >
                    <MdRefresh className={` ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="alert alert-error mb-4">
                    <MdError />
                    <span>{error}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Log Files List */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow">
                        <div className="p-4 border-b">
                            <h2 className="font-semibold flex items-center">
                                <MdFolder className="mr-2" />
                                Log Files
                            </h2>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {loading ? (
                                <div className="p-4 text-center">
                                    <div className="loading loading-spinner loading-md"></div>
                                </div>
                            ) : logFiles.length === 0 ? (
                                <div className="p-4 text-center text-gray-500">
                                    No log files found
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {logFiles.map((dateGroup) => (
                                        <div key={dateGroup.date} className="p-2">
                                            <div className="font-medium text-sm text-gray-600 mb-2">
                                                {dateGroup.formatted_date}
                                            </div>
                                            {dateGroup.files.map((file) => (
                                                <div
                                                    key={file.name}
                                                    className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-gray-50 ${selectedFile === file.name ? "bg-blue-50" : ""
                                                        }`}
                                                    onClick={() => setSelectedFile(file.name)}
                                                >
                                                    <div className="flex items-center flex-1 min-w-0">
                                                        <MdOutlineFilePresent className="text-blue-500 mr-2" />
                                                        <div className="ml-2 min-w-0 flex-1">
                                                            <div className="text-sm font-medium truncate">
                                                                {file.name}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {file.size_formatted}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownload(file.name);
                                                            }}
                                                            className="btn btn-ghost btn-xs"
                                                            title="Download"
                                                        >
                                                            <MdDownload />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(file.name);
                                                            }}
                                                            className="btn btn-ghost btn-xs text-red-500"
                                                            title="Delete"
                                                        >
                                                            <MdDelete />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Log Entries Viewer */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow">
                        <div className="p-4 border-b">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="font-semibold flex items-center">
                                    <MdOutlineFilePresent className="mr-2" />
                                    {selectedFile || "Select a log file"}
                                </h2>
                                {selectedFile && (
                                    <div className="flex gap-2">
                                        <select
                                            value={lines}
                                            onChange={(e) => setLines(Number(e.target.value))}
                                            className="select select-bordered select-xs"
                                        >
                                            <option value={50}>50 lines</option>
                                            <option value={100}>100 lines</option>
                                            <option value={200}>200 lines</option>
                                            <option value={500}>500 lines</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {selectedFile && (
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search logs..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="input input-bordered input-sm w-full pl-10"
                                        />
                                    </div>
                                    <select
                                        value={selectedLevel}
                                        onChange={(e) => setSelectedLevel(e.target.value)}
                                        className="select select-bordered select-sm"
                                    >
                                        <option value="">All Levels</option>
                                        <option value="ERROR">Error</option>
                                        <option value="WARNING">Warning</option>
                                        <option value="INFO">Info</option>
                                        <option value="DEBUG">Debug</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="p-4">
                            {!selectedFile ? (
                                <div className="text-center text-gray-500 py-8">
                                    Select a log file to view its contents
                                </div>
                            ) : loadingEntries ? (
                                <div className="text-center py-8">
                                    <div className="loading loading-spinner loading-md"></div>
                                </div>
                            ) : logEntries.length === 0 ? (
                                <div className="text-center text-gray-500 py-8">
                                    No log entries found
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[65vh] overflow-y-auto">
                                    {logEntries.map((entry, index) => (
                                        <div
                                            key={index}
                                            className="border rounded-lg p-3 hover:bg-gray-50"
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <span
                                                    className={`text-xs px-2 py-1 rounded ${entry.level === "ERROR"
                                                            ? "bg-red-100 text-red-800"
                                                            : entry.level === "WARNING"
                                                                ? "bg-yellow-100 text-yellow-800"
                                                                : entry.level === "INFO"
                                                                    ? "bg-blue-100 text-blue-800"
                                                                    : "bg-gray-100 text-gray-800"
                                                        }`}
                                                >
                                                    {entry.level}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {entry.timestamp}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {entry.environment}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-700">
                                                {entry.message}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogViewer;
