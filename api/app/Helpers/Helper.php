<?php

namespace App\Helpers;

use App\Models\Right;
use App\Models\RoleRight;
use App\Models\Setting;
use App\Models\Otp;
use App\Models\Translation;
use App\Models\ProductStockGroup;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Notifications\Messages\MailMessage;

class Helper
{
    public static function hasRight($right, $role_id = null)
    {
        if ($role_id != null) {
            $role = $role_id;
        } else {
            $role = Auth::user()->role;
        }
        $right = Right::where('name', $right)->first();
        if (RoleRight::where('role_id', $role)->where('right_id', $right->id)->where('permission', 1)->exists()) {
            return true;
        } else {
            return false;
        }
    }

    public static function getSettings($key)
    {
        $settings = Setting::where('key', $key)->first();
        if (!is_null($settings)) {
            return $settings->value;
        } else {
            return false;
        }
    }

    public static function sendEmail($email, $subject, $data, $template = 'default')
    {
        Mail::send('mails.' . $template, ['data' => $data], function ($message) use ($email, $subject) {
            $message->from(env('MAIL_FROM_ADDRESS'), $subject);
            $message->to($email)->subject($subject);
        });
    }

    public static function sendEmailByPHPMail($email, $subject, $body, $template = null)
    {
        $headers = "MIME-Version: 1.0" . "\r\n";
        $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
        $headers .= "From: " . env('MAIL_FROM_ADDRESS') . "\r\n";
        
        $emailSubject = $subject;
        // Remove HtmlString and nl2br since body is already rendered HTML
        $emailBody = $body;
        
        return mail($email, $emailSubject, $emailBody, $headers);
    }

    public static function sendEmailWithMailMessage($email, $subject, $body, $data = [])
    {
        try {
            // Send using Laravel's Mail system with correct method
            Mail::send([], [], function ($message) use ($email, $subject, $body) {
                $message->to($email)
                    ->subject($subject)
                    ->setBody($body, 'text/html'); // Add plain text fallback
            });
            
            return true;
        } catch (\Exception $e) {
            Log::error('MailMessage error: ' . $e->getMessage(), [
                'exception' => $e,
                'trace' => $e->getTraceAsString()
            ]);
            return false;
        }
    }

    public static function checkotp($email, $otp)
    {
        $otp = Otp::where('email', $email)->where('otp', $otp)->where('status', 0)->first();
        if ($otp) {
            return true;
        }
    }

    public static function insertLanguage($translatable_type, $translatable_id, $language_code, $field, $value)
    {
        $language = Translation::firstOrNew(['translatable_type' => $translatable_type, 'translatable_id' => $translatable_id, 'language_code' => $language_code, 'field' => $field]);
        $language->translatable_type = $translatable_type;
        $language->translatable_id = $translatable_id;
        $language->language_code = $language_code;
        $language->field = $field;
        $language->value = $value;
        $language->save();
    }

    public static function deductStockFIFO($productId, $group, $quantityToDeduct)
    {
        DB::beginTransaction();

        try {
            $remainingQty = $quantityToDeduct;

            // Get stock records for the group ordered by `created_at` (FIFO)
            $stockEntries = ProductStockGroup::where('product_id', $productId)
                ->where('group', $group)
                ->where('qty', '>', 0)
                ->orderBy('created_at', 'asc')
                ->lockForUpdate()
                ->get();

            foreach ($stockEntries as $entry) {
                if ($remainingQty <= 0) {
                    break;
                }

                $deductQty = min($entry->qty, $remainingQty);

                $entry->qty -= $deductQty;
                $entry->save();

                $remainingQty -= $deductQty;

                // Optionally, record the deduction in a stock log or sale table
            }

            if ($remainingQty > 0) {
                DB::rollBack();
                return response()->json([
                    'status' => 0,
                    'message' => 'Not enough stock to fulfill the request.',
                ]);
            }

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Stock deducted successfully using FIFO.',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 0,
                'message' => 'Something went wrong during stock deduction.',
                'error' => $e->getMessage(),
            ]);
        }
    }

    public static function formatVariant($variant): string
    {
        if (empty($variant) || !is_array($variant)) return 'N/A';
        return collect($variant)
            ->map(fn($value, $key) => ucfirst($key) . ': ' . $value)
            ->implode(', ');
    }
    
    public static function formatVariantForInventory($variant): string
    {
        if (empty($variant) || !is_array($variant)) return 'N/A';

        return collect($variant)->map(function ($values, $key) {
            // if multiple values, join them with '/'
            $valueStr = is_array($values) ? implode(' / ', $values) : $values;
            return ucfirst($key) . ': ' . $valueStr;
        })->implode(', ');
    }
}
