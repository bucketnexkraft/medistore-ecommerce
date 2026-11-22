<?php

namespace App\Services\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;

class LogViewerService
{
    public function index(Request $request)
    {
        try {
            $logDirectory = storage_path('logs');
            $files = File::glob($logDirectory . '/*.log');

            $logFiles = [];
            foreach ($files as $file) {
                $filename = basename($file);

                if (!preg_match('/^(laravel|application|error)-(\d{4}-\d{2}-\d{2})\.log$/', $filename, $matches)) {
                    continue;
                }

                $type = $matches[1];
                $date = $matches[2];

                if (!isset($logFiles[$date])) {
                    $logFiles[$date] = [
                        'date' => $date,
                        'formatted_date' => date('F j, Y', strtotime($date)),
                        'files' => [],
                    ];
                }

                $logFiles[$date]['files'][] = [
                    'name' => $filename,
                    'type' => $type,
                    'size' => File::size($file),
                    'size_formatted' => $this->formatBytes(File::size($file)),
                    'last_modified' => File::lastModified($file),
                    'last_modified_formatted' => date('Y-m-d H:i:s', File::lastModified($file)),
                ];
            }

            krsort($logFiles);

            return response()->json([
                'status' => 1,
                'data' => array_values($logFiles),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Error reading log files: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function show(Request $request, $filename)
    {
        if (!preg_match('/^[a-zA-Z0-9_-]+-\d{4}-\d{2}-\d{2}\.log$/', $filename)) {
            return response()->json([
                'status' => 0,
                'message' => 'Invalid filename',
            ], 400);
        }

        $logPath = storage_path('logs/' . $filename);

        if (!File::exists($logPath)) {
            return response()->json([
                'status' => 0,
                'message' => 'Log file not found',
            ], 404);
        }

        $lines = $request->get('lines', 100);
        $search = $request->get('search', '');
        $level = $request->get('level', '');

        try {
            $content = File::get($logPath);
            $logEntries = $this->parseLogContent($content, $lines, $search, $level);

            return response()->json([
                'status' => 1,
                'data' => [
                    'filename' => $filename,
                    'entries' => $logEntries,
                    'total_lines' => count($logEntries),
                    'file_size' => File::size($logPath),
                    'file_size_formatted' => $this->formatBytes(File::size($logPath)),
                    'last_modified' => File::lastModified($logPath),
                    'last_modified_formatted' => date('Y-m-d H:i:s', File::lastModified($logPath)),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Error reading log file: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function download(Request $request, $filename)
    {
        if (!preg_match('/^[a-zA-Z0-9_-]+-\d{4}-\d{2}-\d{2}\.log$/', $filename)) {
            return response()->json([
                'status' => 0,
                'message' => 'Invalid filename',
            ], 400);
        }

        $logPath = storage_path('logs/' . $filename);

        if (!File::exists($logPath)) {
            return response()->json([
                'status' => 0,
                'message' => 'Log file not found',
            ], 404);
        }

        return response()->download($logPath, $filename);
    }

    public function destroy(Request $request, $filename)
    {
        if (!preg_match('/^[a-zA-Z0-9_-]+-\d{4}-\d{2}-\d{2}\.log$/', $filename)) {
            return response()->json([
                'status' => 0,
                'message' => 'Invalid filename',
            ], 400);
        }

        $logPath = storage_path('logs/' . $filename);

        if (!File::exists($logPath)) {
            return response()->json([
                'status' => 0,
                'message' => 'Log file not found',
            ], 404);
        }

        try {
            File::delete($logPath);

            return response()->json([
                'status' => 1,
                'message' => 'Log file deleted successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Error deleting log file: ' . $e->getMessage(),
            ], 500);
        }
    }

    private function parseLogContent($content, $lines, $search = '', $level = '')
    {
        $logLines = explode("\n", $content);
        $entries = [];
        $currentEntry = null;
        $count = 0;

        $logLines = array_reverse(array_slice($logLines, -$lines * 2));

        foreach ($logLines as $line) {
            if (empty(trim($line))) {
                continue;
            }

            if (preg_match('/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/', $line)) {
                if ($currentEntry !== null) {
                    if ($this->passesFilters($currentEntry, $search, $level)) {
                        $entries[] = $currentEntry;
                        $count++;
                        if ($count >= $lines) {
                            break;
                        }
                    }
                }
                $currentEntry = $this->parseLogLine($line);
            } elseif ($currentEntry !== null) {
                $currentEntry['stack'][] = $line;
            }
        }

        if ($currentEntry !== null && $this->passesFilters($currentEntry, $search, $level)) {
            $entries[] = $currentEntry;
        }

        return $entries;
    }

    private function parseLogLine($line)
    {
        $pattern = '/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (\w+)\.(\w+): (.+?)(?: \{.*?\})?$/';

        if (preg_match($pattern, $line, $matches)) {
            return [
                'timestamp' => $matches[1],
                'environment' => $matches[2],
                'level' => $matches[3],
                'message' => $matches[4],
                'stack' => [],
            ];
        }

        return [
            'timestamp' => '',
            'environment' => '',
            'level' => 'UNKNOWN',
            'message' => $line,
            'stack' => [],
        ];
    }

    private function passesFilters($entry, $search, $level)
    {
        if (!empty($level) && strtoupper($entry['level']) !== strtoupper($level)) {
            return false;
        }

        if (!empty($search)) {
            $searchLower = strtolower($search);
            return (
                strpos(strtolower($entry['message']), $searchLower) !== false
                || strpos(strtolower($entry['level']), $searchLower) !== false
                || strpos(strtolower($entry['environment']), $searchLower) !== false
            );
        }

        return true;
    }

    private function formatBytes($bytes, $precision = 2)
    {
        $units = ['B', 'KB', 'MB', 'GB'];

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, $precision) . ' ' . $units[$i];
    }
}
