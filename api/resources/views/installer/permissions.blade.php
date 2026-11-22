<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Permissions | stoqio Installer</title>
  <link rel="stylesheet" href="{{ asset('css/installer.css') }}">
</head>
<body><div class="installer-wrap"><div class="installer-card installer-card--permissions">
  <h1 class="installer-title">Folder Permissions</h1><p class="installer-muted">These paths must be writable for setup to continue.</p>
  <div class="installer-steps"><span class="installer-step active"></span><span class="installer-step active"></span><span class="installer-step active"></span><span class="installer-step"></span><span class="installer-step"></span></div>
  <div class="installer-list installer-list--scroll">
    @foreach ($permissions as $path => $isWritable)
      <div class="installer-item"><span class="installer-path">{{ $path }}</span><span class="installer-status {{ $isWritable ? 'ok' : 'bad' }}">{{ $isWritable ? 'Writable' : 'Not Writable' }}</span></div>
    @endforeach
  </div>
  <div class="installer-actions"><a class="installer-btn installer-btn--secondary" href="{{ route('installer.requirements') }}">Back</a><a class="installer-btn installer-btn--primary" href="{{ route('installer.database') }}">Next: Configuration</a></div>
</div></div></body>
</html>
