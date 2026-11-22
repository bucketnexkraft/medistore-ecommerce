<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;

class InstallerController extends Controller
{
    /**
     * Tables that should never be imported from the packaged SQL dump.
     * These contain environment-specific, user-generated, or sensitive data.
     */
    private const EXCLUDED_IMPORT_TABLES = [
        'users',
        'user',
        'company',
        'notifications',
        'personal_access_tokens',
        'password_resets',
        'failed_jobs',
        'jobs',
        'sessions',
        'plan_payment_logs',
        'contact_messages',
        'newsletters',
        'messages',
        'activity_log',
        'user_activities',
    ];

    public function welcome()
    {
        if (File::exists(storage_path('installed'))) {
            abort(403, 'The application is already installed.');
        }

        return view('installer.welcome');
    }

    public function checkRequirements()
    {
        return view('installer.requirements', [
            'requirements' => [
                'PHP Version (>= 8.2)' => version_compare(PHP_VERSION, '8.2.0', '>='),
                'BCMath Extension' => extension_loaded('bcmath'),
                'Ctype Extension' => extension_loaded('ctype'),
                'Fileinfo Extension' => extension_loaded('fileinfo'),
                'JSON Extension' => extension_loaded('json'),
                'Mbstring Extension' => extension_loaded('mbstring'),
                'OpenSSL Extension' => extension_loaded('openssl'),
                'PDO Extension' => extension_loaded('pdo'),
                'Tokenizer Extension' => extension_loaded('tokenizer'),
                'XML Extension' => extension_loaded('xml'),
            ],
        ]);
    }

    public function checkPermissions()
    {
        $paths = [storage_path(), base_path('bootstrap/cache'), base_path('.env')];

        $permissions = [];
        foreach ($paths as $path) {
            $permissions[$path] = is_writable($path);
        }

        return view('installer.permissions', compact('permissions'));
    }

    public function showDatabaseForm()
    {
        return view('installer.database');
    }

    public function saveDatabaseSettings(Request $request)
    {
        $data = $request->validate([
            'app_name' => 'required|string|max:100',
            'app_url' => 'required|url|max:255',
            'app_frontend_url' => 'required|url|max:255',
            'db_host' => 'required|string',
            'db_port' => 'required|integer|min:1|max:65535',
            'db_database' => 'required|string',
            'db_username' => 'required|string',
            'db_password' => 'nullable|string',
        ]);

        if (!$this->checkDatabaseConnection($data)) {
            return back()->withErrors([
                'db_database' => 'Failed to connect to database',
            ])->withInput();
        }

        $this->updateEnv([
            'APP_NAME' => $data['app_name'],
            'APP_URL' => rtrim($data['app_url'], '/'),
            'APP_FRONTEND_URL' => rtrim($data['app_frontend_url'], '/'),
            'APP_ENV' => 'production',
            'APP_DEBUG' => 'false',
            'DB_CONNECTION' => 'mysql',
            'DB_HOST' => $data['db_host'],
            'DB_PORT' => (string) $data['db_port'],
            'DB_DATABASE' => $data['db_database'],
            'DB_USERNAME' => $data['db_username'],
            'DB_PASSWORD' => (string) ($data['db_password'] ?? ''),
            'JWT_SECRET' => $this->resolveJwtSecret(),
        ]);

        return redirect()->route('installer.admin');
    }

    public function showAdminForm()
    {
        return view('installer.admin');
    }

    public function processInstallation(Request $request)
    {
        $sessionData = $request->validate([
            'username' => ['required', 'string', 'max:50', 'regex:/^[a-zA-Z0-9_-]+$/'],
            'email' => 'required|email|max:100',
            'password' => 'required|min:6|confirmed',
            'smtp_host' => 'required|string|max:100',
            'smtp_port' => 'required|numeric',
            'smtp_username' => 'required|string|max:100',
            'smtp_password' => 'required|string|max:191',
            'smtp_encryption' => 'nullable|in:tls,ssl',
            'email_send_from' => 'required|email|max:100',
            'email_from_name' => 'required|string|max:100',
        ]);

        try {
            $this->ensureDatabaseIsEmpty();
            $this->importSqlFromDirectory(base_path('database/sql'));
        } catch (\Throwable $e) {
            return redirect()->route('installer.database')->withErrors([
                'db_database' => $e->getMessage(),
            ]);
        }

        User::query()->updateOrCreate(
            ['email' => $sessionData['email']],
            [
                'first_name' => $sessionData['username'],
                'last_name' => 'Admin',
                'phone' => '01700000000',
                'password' => Hash::make($sessionData['password']),
                'role' => 1,
                'is_super_admin' => 1,
            ]
        );

        Setting::query()->updateOrCreate(
            ['key' => 'email_configuration'],
            [
                'value' => json_encode([
                    'email_method' => 'smtp',
                    'smtp_host' => $sessionData['smtp_host'],
                    'smtp_port' => $sessionData['smtp_port'],
                    'smtp_username' => $sessionData['smtp_username'],
                    'smtp_password' => $sessionData['smtp_password'],
                    'smtp_encryption' => $sessionData['smtp_encryption'] ?? 'tls',
                    'email_send_from' => $sessionData['email_send_from'],
                    'email_from_name' => $sessionData['email_from_name'],
                ]),
                'is_active' => true,
            ]
        );

        File::put(storage_path('installed'), now()->toDateTimeString());

        return redirect('/')->with('success', 'Installation completed successfully.');
    }

    private function ensureDatabaseIsEmpty(): void
    {
        DB::connection()->getPdo();

        $existingTables = DB::select("
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
              AND table_type = 'BASE TABLE'
        ");

        if (!empty($existingTables)) {
            throw new \RuntimeException(
                'The selected database is not empty. Please use a fresh empty database for installation.'
            );
        }
    }

    private function importSqlFromDirectory(string $directory): void
    {
        if (!is_dir($directory)) {
            throw new \RuntimeException('database/sql directory not found.');
        }

        $sqlFiles = collect(File::files($directory))
            ->filter(fn ($file) => strtolower($file->getExtension()) === 'sql')
            ->sortBy(fn ($file) => $file->getFilename())
            ->values();

        if ($sqlFiles->isEmpty()) {
            throw new \RuntimeException('No SQL file found in database/sql.');
        }

        DB::connection()->getPdo();
        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        try {
            foreach ($sqlFiles as $sqlFile) {
                $sql = File::get($sqlFile->getRealPath());
                if (trim($sql) === '') {
                    continue;
                }

                foreach ($this->splitSqlStatements($sql) as $statement) {
                    if ($this->shouldSkipImportStatement($statement)) {
                        continue;
                    }

                    DB::unprepared($statement);
                }
            }
        } finally {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }
    }

    private function splitSqlStatements(string $sql): array
    {
        $statements = [];
        $buffer = '';
        $length = strlen($sql);
        $inString = false;
        $quote = null;

        for ($i = 0; $i < $length; $i++) {
            $char = $sql[$i];
            $buffer .= $char;

            if ($inString) {
                if ($char === $quote && ($i === 0 || $sql[$i - 1] !== '\\')) {
                    $inString = false;
                    $quote = null;
                }

                continue;
            }

            if ($char === "'" || $char === '"') {
                $inString = true;
                $quote = $char;
                continue;
            }

            if ($char === ';') {
                $statement = trim($buffer);
                if ($statement !== '') {
                    $statements[] = $statement;
                }
                $buffer = '';
            }
        }

        $tail = trim($buffer);
        if ($tail !== '') {
            $statements[] = $tail;
        }

        return $statements;
    }

    private function shouldSkipImportStatement(string $statement): bool
    {
        $normalized = ltrim($statement);

        if (str_starts_with($normalized, '--') || str_starts_with($normalized, '/*') || str_starts_with($normalized, '/*!')) {
            return false;
        }

        if (!preg_match('/^INSERT\s+INTO\s+`?([a-zA-Z0-9_]+)`?/i', $normalized, $matches)) {
            return false;
        }

        return in_array(strtolower($matches[1]), self::EXCLUDED_IMPORT_TABLES, true);
    }

    protected function updateEnv(array $values): void
    {
        $envPath = base_path('.env');

        if (!file_exists($envPath)) {
            throw new \RuntimeException('.env file not found');
        }

        if (!is_writable($envPath)) {
            throw new \RuntimeException('.env file is not writable');
        }

        $envContent = file_get_contents($envPath);

        foreach ($values as $key => $value) {
            $escapedValue = str_replace('"', '\\"', (string) $value);

            if (preg_match("/^{$key}=.*/m", $envContent)) {
                $envContent = preg_replace("/^{$key}=.*/m", "{$key}=\"{$escapedValue}\"", $envContent);
            } else {
                $envContent .= PHP_EOL . "{$key}=\"{$escapedValue}\"";
            }
        }

        file_put_contents($envPath, trim($envContent) . PHP_EOL);
    }

    private function resolveJwtSecret(): string
    {
        $currentSecret = trim((string) env('JWT_SECRET', ''));

        if ($currentSecret !== '') {
            return $currentSecret;
        }

        return base64_encode(random_bytes(32));
    }

    private function checkDatabaseConnection(array $payloads): bool
    {
        $settings = config('database.connections.mysql');

        config([
            'database.default' => 'mysql',
            'database.connections.mysql' => array_merge($settings, [
                'driver' => 'mysql',
                'host' => $payloads['db_host'],
                'port' => $payloads['db_port'],
                'database' => $payloads['db_database'],
                'username' => $payloads['db_username'],
                'password' => $payloads['db_password'] ?? '',
            ]),
        ]);

        DB::purge('mysql');

        try {
            DB::connection('mysql')->getPdo();
            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }
}
