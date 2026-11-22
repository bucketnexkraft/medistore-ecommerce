<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Configuration | stoqio Installer</title>
  <link rel="stylesheet" href="{{ asset('css/installer.css') }}">
</head>
<body><div class="installer-wrap"><div class="installer-card installer-card--database">
  <h1 class="installer-title">Configuration</h1><p class="installer-muted">Set app and database connection details.</p>
  <div class="installer-steps"><span class="installer-step active"></span><span class="installer-step active"></span><span class="installer-step active"></span><span class="installer-step active"></span><span class="installer-step"></span></div>

  @if($errors->any())
    <div class="installer-error"><ul class="installer-error-list">@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul></div>
  @endif

  <form method="POST" action="{{ route('installer.database.save') }}">
    @csrf
    <div class="installer-group">App Settings</div>
    <div class="installer-field"><label class="installer-label">App Name</label><input class="installer-input" type="text" name="app_name" value="{{ old('app_name') }}" placeholder="stoqio" required></div>
    <div class="installer-field"><label class="installer-label">Backend App URL</label><input class="installer-input" type="url" name="app_url" value="{{ old('app_url', request()->getSchemeAndHttpHost()) }}" placeholder="http://127.0.0.1:8000" required></div>
    <div class="installer-field"><label class="installer-label">React Frontend URL</label><input class="installer-input" type="url" name="app_frontend_url" value="{{ old('app_frontend_url') }}" placeholder="http://localhost:5173" required></div>

    <div class="installer-group">Database Details</div>
    <div class="installer-grid-2">
      <div class="installer-field"><label class="installer-label">Host</label><input class="installer-input" type="text" name="db_host" value="{{ old('db_host', '127.0.0.1') }}" required></div>
      <div class="installer-field"><label class="installer-label">Port</label><input class="installer-input" type="text" name="db_port" value="{{ old('db_port', '3306') }}" required></div>
    </div>
    <div class="installer-field"><label class="installer-label">Database Name</label><input class="installer-input" type="text" name="db_database" value="{{ old('db_database') }}" required></div>
    <div class="installer-field"><label class="installer-label">Username</label><input class="installer-input" type="text" name="db_username" value="{{ old('db_username') }}" required></div>
    <div class="installer-field"><label class="installer-label">Password</label><input class="installer-input" type="password" name="db_password" value="{{ old('db_password') }}"></div>

    <div class="installer-actions">
      <a class="installer-btn installer-btn--secondary" href="{{ route('installer.permissions') }}">Back</a>
      <button type="submit" class="installer-btn installer-btn--primary">Continue to Admin Setup</button>
    </div>
  </form>
</div></div></body>
</html>
