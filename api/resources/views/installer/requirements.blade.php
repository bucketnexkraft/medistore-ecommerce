<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Requirements | stoqio Installer</title>
  <link rel="stylesheet" href="{{ asset('css/installer.css') }}">
</head>
<body><div class="installer-wrap"><div class="installer-card installer-card--requirements">
  <div class="installer-top"><div><h1 class="installer-title">Server Requirements</h1><p class="installer-muted">Check required PHP extensions before continuing.</p></div></div>
  <div class="installer-steps"><span class="installer-step active"></span><span class="installer-step active"></span><span class="installer-step"></span><span class="installer-step"></span><span class="installer-step"></span></div>
  <div class="installer-list">
    @foreach ($requirements as $key => $status)
      <div class="installer-item"><span>{{ $key }}</span><span class="installer-status {{ $status ? 'ok' : 'bad' }}">{{ $status ? 'Passed' : 'Failed' }}</span></div>
    @endforeach
  </div>
  <div class="installer-actions"><a class="installer-btn installer-btn--secondary" href="{{ route('installer.welcome') }}">Back</a><a class="installer-btn installer-btn--primary" href="{{ route('installer.permissions') }}">Next: Permissions</a></div>
</div></div></body>
</html>
