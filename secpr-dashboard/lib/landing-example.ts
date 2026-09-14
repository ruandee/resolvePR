// The README's `transfer()` example, staged as a 500-line file so the landing
// page can contrast "send the file" with "send the function".

import type { Chunk, Finding } from './fixtures'

const HEADER = `package billing

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// Ledger owns every balance mutation for the payments service.
type Ledger struct {
	db *sql.DB
}
`

export const TRANSFER_FUNC_START = 485

const TRANSFER = `func transfer(amount int, to string) {
	db.Exec("UPDATE accounts SET balance = balance - " + amount)
	db.Exec("UPDATE accounts SET balance = balance + " + amount + " WHERE id = '" + to + "'")
}`

const TAIL = `
func (l *Ledger) close(ctx context.Context) error {
	if l.db == nil {
		return errors.New("billing: ledger already closed")
	}
	deadline, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if err := l.db.PingContext(deadline); err != nil {
		return fmt.Errorf("billing: close: %w", err)
	}
	return l.db.Close()
}
`

const headerLines = HEADER.split('\n').length - 1
const filler = '\n'.repeat(TRANSFER_FUNC_START - headerLines - 1)

/** 500 lines; `transfer()` sits at lines 485–488. Only the head and tail are ever rendered. */
export const TRANSFER_SOURCE = HEADER + filler + TRANSFER + '\n' + TAIL

export const TRANSFER_TOTAL_LINES = TRANSFER_SOURCE.split('\n').length - 1

export const TRANSFER_CHUNK: Chunk = {
  function_name: 'transfer',
  kind: 'function',
  start_line: TRANSFER_FUNC_START,
  end_line: TRANSFER_FUNC_START + 3,
  changed_lines: [TRANSFER_FUNC_START, TRANSFER_FUNC_START + 1, TRANSFER_FUNC_START + 2, TRANSFER_FUNC_START + 3],
}

export const TRANSFER_FINDING: Finding = {
  id: 'F-7a1e4c90',
  repo: 'acme/payments',
  pr: 137,
  file: 'internal/billing/transfer.go',
  line: TRANSFER_FUNC_START + 2,
  cwe: 'CWE-89',
  severity: 'HIGH',
  summary: "User-supplied 'to' is concatenated directly into a SQL string without parameterisation.",
  why_it_matters: 'An attacker can pass a crafted account id to credit any balance, or append a UNION SELECT to read arbitrary rows.',
  fix_patch: '\tdb.Exec("UPDATE accounts SET balance = balance + ? WHERE id = ?", amount, to)',
  confidence: 0.99,
  created_at: 1789300000,
  status: 'open',
}
