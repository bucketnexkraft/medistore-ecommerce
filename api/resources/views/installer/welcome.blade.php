<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome | stoqio Installer</title>
  <link rel="stylesheet" href="{{ asset('css/installer.css') }}">
</head>
<body>
<div class="installer-wrap">
  <div class="installer-card installer-card--welcome">
    <span class="installer-badge">Installer</span>
    <h1 class="installer-title installer-title--welcome">Welcome to stoqio Setup</h1>
    <p class="installer-muted installer-muted--welcome">This wizard will configure environment, database, and administrator account in a few steps.</p>
    <div class="installer-steps installer-steps--welcome">
      <span class="installer-step active"></span><span class="installer-step"></span><span class="installer-step"></span><span class="installer-step"></span><span class="installer-step"></span>
    </div>
    <div class="installer-actions installer-actions--welcome">
      <a class="installer-btn installer-btn--primary installer-btn--welcome" href="{{ route('installer.requirements') }}">Start Installation</a>
    </div>
  </div>
</div>
</body>
</html>
