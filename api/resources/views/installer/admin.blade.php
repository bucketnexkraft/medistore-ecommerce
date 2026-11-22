<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Setup | stoqio Installer</title>
  <link rel="stylesheet" href="{{ asset('css/installer.css') }}">
</head>
<body><div class="installer-wrap"><div class="installer-card installer-card--admin">
  <h1 class="installer-title">Admin & SMTP Setup</h1><p class="installer-muted">Create administrator account and configure outgoing email.</p>
  <div class="installer-steps"><span class="installer-step active"></span><span class="installer-step active"></span><span class="installer-step active"></span><span class="installer-step active"></span><span class="installer-step active"></span></div>

  @if($errors->any())
    <div class="installer-error"><ul class="installer-error-list">@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul></div>
  @endif

  <form method="POST" action="{{ route('installer.process') }}">
    @csrf
    <div class="installer-group">Admin Account</div>
    <div class="installer-grid-even">
      <div class="installer-field"><label class="installer-label">Username</label><input class="installer-input" type="text" name="username" value="{{ old('username') }}" required></div>
      <div class="installer-field"><label class="installer-label">Email</label><input class="installer-input" type="email" name="email" value="{{ old('email') }}" required></div>
      <div class="installer-field"><label class="installer-label">Password</label><input class="installer-input" type="password" name="password" required></div>
      <div class="installer-field"><label class="installer-label">Confirm Password</label><input class="installer-input" type="password" name="password_confirmation" required></div>
    </div>

    <div class="installer-group">SMTP Settings</div>
    <div class="installer-grid-even">
      <div class="installer-field"><label class="installer-label">SMTP Host</label><input class="installer-input" type="text" name="smtp_host" value="{{ old('smtp_host') }}" required></div>
      <div class="installer-field"><label class="installer-label">SMTP Port</label><input class="installer-input" type="text" name="smtp_port" value="{{ old('smtp_port', 587) }}" required></div>
      <div class="installer-field"><label class="installer-label">SMTP Username</label><input class="installer-input" type="text" name="smtp_username" value="{{ old('smtp_username') }}" required></div>
      <div class="installer-field"><label class="installer-label">SMTP Password</label><input class="installer-input" type="password" name="smtp_password" value="{{ old('smtp_password') }}" required></div>
      <div class="installer-field"><label class="installer-label">Encryption</label><select class="installer-select" name="smtp_encryption"><option value="tls" {{ old('smtp_encryption','tls')==='tls' ? 'selected' : '' }}>tls</option><option value="ssl" {{ old('smtp_encryption')==='ssl' ? 'selected' : '' }}>ssl</option></select></div>
      <div class="installer-field"><label class="installer-label">From Email</label><input class="installer-input" type="email" name="email_send_from" value="{{ old('email_send_from') }}" required></div>
      <div class="installer-field installer-field--full"><label class="installer-label">From Name</label><input class="installer-input" type="text" name="email_from_name" value="{{ old('email_from_name') }}" required></div>
    </div>

    <div class="installer-actions">
      <a class="installer-btn installer-btn--secondary" href="{{ route('installer.database') }}">Back</a>
      <button type="submit" class="installer-btn installer-btn--primary">Complete Installation</button>
    </div>
  </form>
</div></div></body>
</html>
