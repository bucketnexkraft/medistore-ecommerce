<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    use HasFactory;

    public $fillable =[
        'key',
        'value',
        'status'
    ];

    protected $casts = [
        'value' => 'object',
    ];

    public function getValueAttribute($value)
    {
        // Define the keys that represent image paths
        $imageKeys = ['site_logo', 'site_favicon', 'profile_picture', 'white_logo', 'dark_logo', 'icon'];

        // Check if the key is in the defined imageKeys array
        if (in_array($this->key, $imageKeys) && !empty($value)) {
            return get_file($value, 'settings');
        }

        return $value; // Return the original value for other keys
    }
}
