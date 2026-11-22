<?php

namespace App\Mail;

use App\Models\Company;
use App\Models\Invoice;
use App\Models\PaymentSchedule;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PaymentReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    public $schedule;
    public $recipientType;

    public function __construct(PaymentSchedule $schedule, $recipientType)
    {
        $this->schedule = $schedule;
        $this->recipientType = $recipientType;
    }

    public function build()
    {
        $invoice = Invoice::find($this->schedule->invoice_id);
        $customer = User::find($invoice->customer_id);
        $company = Company::find($invoice->company_id ?? '650293876e6bf-comp-68607265728322501');

        return $this->subject('Payment Reminder for Invoice #' . $invoice->id)
                    ->view('mails.payment_reminder')
                    ->with([
                        'schedule' => $this->schedule,
                        'invoice' => $invoice,
                        'customer' => $customer,
                        'company' => $company,
                        'recipientType' => $this->recipientType,
                    ]);
    }
}
