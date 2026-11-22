<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Question extends Model
{
    use HasFactory;
    protected $table = 'questions';
    protected $appends = array('segments');

    public function getSegmentsAttribute()
    {
        $segmentIds = json_decode($this->segmentation, true);
    
        if (!is_array($segmentIds)) {
            return collect(); // Return an empty collection if invalid
        }
        // Fetch and return related Segmentation records
        return Segmentation::whereIn('id', $segmentIds)->get();
    }

    protected static function boot()
    {
        parent::boot();

        static::deleting(function ($question) {
            // Delete related options
            $question->options()->delete();
        });
    }

    public function company(){
        return $this->belongsTo(Company::class, 'company_id', 'company_id');
    }

    public function options(){
        return $this->hasMany(QuestionOption::class, 'question_id', 'id');
    }

    public function purpose(){
        return $this->belongsTo(CustomOption::class, 'exam_purpose', 'id');
    }
}
