<?php

namespace App\Services\Api;

use App\Models\Timesheet;
use App\Models\TimesheetCashHandover;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TimesheetService
{
    private function buildCashflowSummary(Timesheet $shift): array
    {
        $start = $shift->start_time;
        $end = $shift->end_time ?? now();

        $baseQuery = DB::table('transactions')
            ->leftJoin('invoices', 'invoices.id', '=', 'transactions.invoice_id')
            ->where('transactions.user_id', $shift->subject_user_id)
            ->whereBetween('transactions.created_at', [$start, $end]);

        $totalSalesCash = (float) (clone $baseQuery)
            ->where('invoices.type', 'sale')
            ->sum('transactions.amount');

        $totalRefundCash = (float) (clone $baseQuery)
            ->whereIn('invoices.type', ['return', 'sell-return'])
            ->sum('transactions.amount');

        $totalInflowCash = $totalSalesCash;
        $totalOutflowCash = $totalRefundCash;
        $totalCashHandedOver = (float) TimesheetCashHandover::where('timesheet_id', $shift->id)->sum('amount');
        $expectedClosingCash = (float) $shift->cash_in_hand + $totalInflowCash - $totalOutflowCash - $totalCashHandedOver;
        $transactionCount = (int) (clone $baseQuery)->count('transactions.id');

        return [
            'opening_cash' => (float) $shift->cash_in_hand,
            'total_sales_cash' => $totalSalesCash,
            'total_refund_cash' => $totalRefundCash,
            'total_inflow_cash' => $totalInflowCash,
            'total_outflow_cash' => $totalOutflowCash,
            'total_cash_handed_over' => $totalCashHandedOver,
            'expected_closing_cash' => $expectedClosingCash,
            'total_transactions' => $transactionCount,
        ];
    }

    public function getUsers(): array
    {
        $users = User::select('id', 'first_name', 'last_name', 'email')
            ->where('status', 1)
            ->where('role', '<>', 2)
            ->orderBy('first_name')
            ->get();

        return [
            'status' => 1,
            'data' => $users,
        ];
    }

    public function currentShift()
    {
        $user = Auth::user();
        $shift = Timesheet::with(['subjectUser', 'sourceUser'])
            ->where('subject_user_id', $user->id)
            ->whereNull('end_time')
            ->first();

        if (!$shift) {
            return null;
        }

        $summary = $this->buildCashflowSummary($shift);
        return array_merge($shift->toArray(), ['cashflow_summary' => $summary]);
    }

    public function closeSummary(): array
    {
        $user = Auth::user();
        $shift = Timesheet::where('subject_user_id', $user->id)
            ->whereNull('end_time')
            ->first();

        if (!$shift) {
            return [[
                'status' => 0,
                'message' => 'No active shift found',
            ], 404];
        }

        return [[
            'status' => 1,
            'message' => 'Shift closing summary generated',
            'data' => $this->buildCashflowSummary($shift),
        ], 200];
    }

    public function startShift(Request $request): array
    {
        $user = Auth::user();

        $active = Timesheet::where('subject_user_id', $user->id)
            ->whereNull('end_time')
            ->exists();

        if ($active) {
            return [[
                'message' => 'You already have an active shift',
            ], 400];
        }

        $shift = Timesheet::create([
            'subject_user_id' => $user->id,
            'source_user_id' => $user->id,
            'cash_in_hand' => $request->cash_in_hand,
            'comments' => $request->comments,
        ]);

        return [$shift, 201];
    }

    public function handoverShift(Request $request): array
    {
        $user = Auth::user();

        $currentShift = Timesheet::where('subject_user_id', $user->id)
            ->whereNull('end_time')
            ->firstOrFail();

        $summary = $this->buildCashflowSummary($currentShift);
        $actualClosing = (float) $request->cash_out_hand;
        $handoverCash = (float) $request->cash_in_hand;
        $variance = $actualClosing - (float) $summary['expected_closing_cash'];

        $currentShift->update([
            'end_time' => now(),
            'cash_out_hand' => $actualClosing,
            'total_sales_cash' => $summary['total_sales_cash'],
            'total_refund_cash' => $summary['total_refund_cash'],
            'total_inflow_cash' => $summary['total_inflow_cash'],
            'total_outflow_cash' => $summary['total_outflow_cash'],
            'expected_closing_cash' => $summary['expected_closing_cash'],
            'cash_variance' => $variance,
            'handover_cash' => $handoverCash,
            'total_transactions' => $summary['total_transactions'],
            'closed_by_user_id' => $user->id,
            'comments' => $currentShift->comments . "\n[Handover] " . ($request->comments ?? ''),
        ]);

        Timesheet::create([
            'subject_user_id' => $request->subject_user_id,
            'source_user_id' => $user->id,
            'cash_in_hand' => $request->cash_in_hand,
            'comments' => "Handover from {$user->first_name} {$user->last_name}: " . ($request->comments ?? ''),
        ]);

        return [[
            'status' => 1,
            'message' => 'Shift handed over successfully',
            'cashflow_summary' => [
                ...$summary,
                'actual_closing_cash' => $actualClosing,
                'handover_cash' => $handoverCash,
                'cash_variance' => $variance,
            ],
        ], 200];
    }

    public function cashHandover(Request $request): array
    {
        $user = Auth::user();

        $currentShift = Timesheet::where('subject_user_id', $user->id)
            ->whereNull('end_time')
            ->first();

        $amount = (float) $request->amount;
        if ($amount <= 0) {
            return [[
                'status' => 0,
                'message' => 'Cash handover amount must be greater than zero',
            ], 422];
        }

        if ($currentShift) {
            $summaryBefore = $this->buildCashflowSummary($currentShift);
            if ($amount > (float) $summaryBefore['expected_closing_cash']) {
                return [[
                    'status' => 0,
                    'message' => 'Cash handover amount cannot exceed current expected cash',
                ], 422];
            }
        }

        $entry = TimesheetCashHandover::create([
            'timesheet_id' => $currentShift?->id,
            'company_id' => $user->company_id,
            'cashier_user_id' => $user->id,
            'received_by_user_id' => $request->received_by_user_id,
            'amount' => $amount,
            'notes' => $request->notes,
        ]);

        $summaryAfter = $currentShift ? $this->buildCashflowSummary($currentShift->fresh()) : null;

        return [[
            'status' => 1,
            'message' => 'Cash handed over successfully',
            'data' => $entry,
            'cashflow_summary' => $summaryAfter,
        ], 200];
    }
}
