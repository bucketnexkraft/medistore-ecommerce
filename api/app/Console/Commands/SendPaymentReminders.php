<?php

namespace App\Console\Commands;

use App\Mail\PaymentReminderMail;
use App\Models\Company;
use App\Models\Invoice;
use App\Models\PaymentSchedule;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class SendPaymentReminders extends Command
{
    protected $signature = 'payment:send-reminders';
    protected $description = 'Send payment reminder emails for scheduled payments';

    public function handle()
    {
        $today = now()->toDateString();
        $schedules = PaymentSchedule::where('remainder_date', $today)
            ->where('status', 'DUE')
            ->get();

        foreach ($schedules as $schedule) {
            $invoice = Invoice::find($schedule->invoice_id);
            $customer = User::find($invoice->customer_id);
            $company = Company::find($invoice->company_id ?? '650293876e6bf-comp-68607265728322501');

            if ($customer && $customer->email) {
                Mail::to($customer->email)->send(new PaymentReminderMail($schedule, 'customer'));
            }
            if ($company && $company->email) {
                Mail::to($company->email)->send(new PaymentReminderMail($schedule, 'owner'));
            }
        }

        $this->info('Payment reminders sent successfully.');
    }
}
