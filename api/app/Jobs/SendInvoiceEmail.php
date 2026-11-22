<?php

namespace App\Jobs;

use App\Helpers\Helper;
use App\Models\Invoice;
use App\Services\DynamicMailService;
use App\Services\EmailTemplateService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;

class SendInvoiceEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public Invoice $invoice;
    public string $email;
    public $tries = 3;
    public $backoff = [60, 300, 900]; // 1min, 5min, 15min

    /**
     * Create a new job instance.
     *
     * @param Invoice $invoice
     * @param string $email
     */
    public function __construct(Invoice $invoice, string $email)
    {
        $this->invoice = $invoice;
        $this->email = $email;
    }

    /**
     * Execute the job.
     *
     * @return void
     */
    public function handle(DynamicMailService $dynamicMailService, EmailTemplateService $templateService)
    {
        try {
            $this->invoice->loadMissing(['items.product', 'customer', 'supplier', 'paymentSchedules']);

            // Get company preferences
            $companyInfo = [
                'name' => Helper::getSettings('application_name') ?? 'Your Business',
                'email' => Helper::getSettings('application_email') ?? 'contact@yourbusiness.com',
                'phone' => Helper::getSettings('application_phone') ?? 'N/A',
                'address' => Helper::getSettings('application_address') ?? 'N/A',
                'logo' => Helper::getSettings('site_logo') ?? '',
                'vat' => Helper::getSettings('vat_number') ?? '',
            ];

            // Generate download link
            $downloadLink = URL::temporarySignedRoute(
                'invoices.download',
                now()->addDays(7),
                ['id' => $this->invoice->id]
            );

            // Generate barcode HTML
            $barcodeHtml = \DNS1D::getBarcodeHTML($this->invoice->invoice_no, 'C39', 2, 50);
    
            // Ensure barcode HTML is properly encoded
            $barcodeHtml = html_entity_decode($barcodeHtml, ENT_QUOTES, 'UTF-8');

            // Prepare email data
            $emailData = [
                'invoice' => $this->invoice,
                'companyInfo' => $companyInfo,
                'downloadLink' => $downloadLink,
                'customerName' => $this->invoice->customer ? $this->invoice->customer->first_name . ' ' . $this->invoice->customer?->last_name : ($this->invoice->supplier ? $this->invoice->supplier->name : 'Valued Customer'),
                'invoiceNumber' => $this->invoice->invoice_no,
                'invoiceDate' => \Carbon\Carbon::parse($this->invoice->date)->format('M d, Y'),
                'totalAmount' => number_format($this->invoice->total, 2),
                'dueAmount' => number_format($this->invoice->due_amount, 2),
                'paymentStatus' => $this->invoice->payment_status == 1 ? 'Paid' : ($this->invoice->payment_status == 0 ? 'Unpaid' : 'Partially Paid'),
                'barcodeHtml' => $barcodeHtml,
            ];

            $defaultSubject = $this->invoice->type === 'quotation'
                ? "Quotation #{$this->invoice->invoice_no} from {$companyInfo['name']}"
                : "Invoice #{$this->invoice->invoice_no} from {$companyInfo['name']}";

            $emailSubject = $defaultSubject;
            $emailBody = view('mails.invoice', ['data' => $emailData])->render();

            if ($this->invoice->type === 'quotation') {
                $template = $templateService->getActiveTemplateByKey('quotation_email');
                if ($template) {
                    $rendered = $templateService->renderTemplate($template, [
                        'company_name' => $companyInfo['name'],
                        'customer_name' => $emailData['customerName'],
                        'quotation_no' => $this->invoice->invoice_no,
                        'quotation_date' => $emailData['invoiceDate'],
                        'quotation_total' => $emailData['totalAmount'],
                        'download_link' => $downloadLink,
                    ]);
                    $emailSubject = $rendered['subject'] ?: $defaultSubject;
                    $emailBody = $rendered['body'] ?: $emailBody;
                }
            }

            // Keep this job lightweight like registration mail. The email includes
            // a secure download link instead of generating a PDF during sending.
            $result = $dynamicMailService->sendHtml(
                $this->email,
                $emailSubject,
                $emailBody
            );

            if (!$result) {
                throw new \Exception('Failed to send invoice email');
            }

            Log::info("Invoice email sent successfully to {$this->email} for invoice #{$this->invoice->invoice_no}");

        } catch (\Exception $e) {
            Log::error("Failed to send invoice email to {$this->email} for invoice #{$this->invoice->invoice_no}: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Handle a job failure.
     *
     * @param \Throwable $exception
     * @return void
     */
    public function failed(\Throwable $exception)
    {
        Log::error("SendInvoiceEmail job failed for invoice #{$this->invoice->invoice_no}: " . $exception->getMessage());
    }
}
