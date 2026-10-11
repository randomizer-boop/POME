// ─── Export: pick a period and a format → a file is built in the browser ──────

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { locale, t } from '../../shared/i18n';
import { isoDay } from '../../shared/config';
import { monthName } from '../../shared/format';
import { Field, FormMessage, PrimaryButton, fieldStyle } from '../../shared/ui/primitives';
import { useFinance } from '../../store/FinanceStore';
import { useSettings } from '../../store/Settings';
import { buildXlsx } from './xlsx';
import {
  buildReport, earliestDate, isValidRange, rangeFor, reportCounts, reportFileName, transactionsCsv,
  type RangeKind, type ReportInput, type ReportRange,
} from './report';

type Format = 'xlsx' | 'csv';

const fmtDateFull = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });

/** Saves bytes as a file (nothing leaves the device) */
function download(data: Uint8Array | string, name: string, type: string) {
  const blob = new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const f = useFinance();
  const { rates, currency, ratesUpdatedAt, ratesLive } = useSettings();
  const [kind, setKind] = useState<RangeKind>('month');
  const [fmt, setFmt] = useState<Format>('xlsx');
  const todayIso = isoDay(f.today, f.today.current);
  const [custom, setCustom] = useState<ReportRange>({ from: isoDay(f.period, 1), to: todayIso });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const range = useMemo(
    () => rangeFor(kind, f.period, f.today, earliestDate(f.allTransactions, f.allTransfers), custom),
    [kind, f.period, f.today, f.allTransactions, f.allTransfers, custom],
  );
  const valid = isValidRange(range);
  const counts = reportCounts({ transactions: f.allTransactions, transfers: f.allTransfers, range });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) { setError(t('exp.errRange')); return; }
    const input: ReportInput = {
      accounts: f.accounts, transactions: f.allTransactions, transfers: f.allTransfers,
      recurring: f.recurring, goals: f.goals, allocations: f.allocations,
      rates, currency, range, generatedAt: new Date(), ratesUpdatedAt, ratesLive,
    };
    const name = reportFileName(range, fmt);
    if (fmt === 'xlsx') {
      download(buildXlsx(buildReport(input)), name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else {
      download(transactionsCsv(input), name, 'text/csv;charset=utf-8');
    }
    setError(null);
    setDone(t('exp.done', { f: name }));
  };

  const presets: { k: RangeKind; label: string }[] = [
    { k: 'month', label: `${monthName(f.period)} ${f.period.year}` },
    { k: 'quarter', label: t('exp.rQuarter') },
    { k: 'year', label: t('exp.rYear') },
    { k: 'all', label: t('exp.rAll') },
    { k: 'custom', label: t('exp.rCustom') },
  ];

  const chip = (on: boolean) => ({
    padding: '7px 12px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
    border: `1px solid ${on ? 'var(--color-ink)' : 'var(--line-strong)'}`,
    background: on ? 'var(--color-ink)' : 'var(--color-card)', color: on ? '#fff' : 'var(--color-ink-2)',
  });

  const formatCard = (k: Format, title: string, hint: string) => {
    const on = fmt === k;
    return (
      <button type="button" role="radio" aria-checked={on} onClick={() => { setFmt(k); setDone(null); }} style={{
        flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
        border: `1px solid ${on ? 'var(--color-ink)' : 'var(--line)'}`, background: on ? 'var(--color-bg)' : 'var(--color-card)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-ink)', marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12, lineHeight: 1.35, color: 'var(--color-ink-3)' }}>{hint}</div>
      </button>
    );
  };

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      className="sheet-wrap"
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(26,23,20,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <form
        role="dialog" aria-modal="true" aria-label={t('exp.dialogTitle')} onSubmit={submit} noValidate className="view-enter sheet"
        style={{
          width: 500, maxWidth: 'calc(100vw - 32px)', background: 'var(--color-card)', borderRadius: 18,
          border: '1px solid var(--line)', boxShadow: '0 24px 60px rgba(26,23,20,0.22)', padding: '18px 22px 20px',
          maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 22, fontWeight: 500 }}>{t('exp.dialogTitle')}</div>
          <button type="button" onClick={onClose} aria-label={t('close')} className="icon-btn" style={{ border: 'none' }}>✕</button>
        </div>

        <div style={{ fontSize: 11, color: 'var(--color-ink-3)', marginBottom: 6 }}>{t('exp.rangeLabel')}</div>
        <div role="radiogroup" aria-label={t('exp.rangeLabel')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {presets.map(p => (
            <button key={p.k} type="button" role="radio" aria-checked={kind === p.k} style={chip(kind === p.k)}
              onClick={() => { setKind(p.k); setError(null); setDone(null); }}>
              {p.label}
            </button>
          ))}
        </div>

        {kind === 'custom' && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <Field label={t('exp.from')} style={{ flex: 1 }}>
              <input type="date" min="2000-01-01" max={todayIso} value={custom.from} style={fieldStyle}
                onChange={e => { setCustom(c => ({ ...c, from: e.target.value })); setError(null); setDone(null); }} />
            </Field>
            <Field label={t('exp.to')} style={{ flex: 1 }}>
              <input type="date" min="2000-01-01" value={custom.to} style={fieldStyle}
                onChange={e => { setCustom(c => ({ ...c, to: e.target.value })); setError(null); setDone(null); }} />
            </Field>
          </div>
        )}

        <div style={{ fontSize: 12, lineHeight: 1.5, color: valid ? 'var(--color-ink-2)' : 'var(--color-negative)', marginBottom: 16 }}>
          {valid ? (
            <>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtDateFull(range.from)} — {fmtDateFull(range.to)}</span>
              <br />{t('exp.count', { n: counts.transactions, m: counts.transfers })}
            </>
          ) : t('exp.errRange')}
        </div>

        <div style={{ fontSize: 11, color: 'var(--color-ink-3)', marginBottom: 6 }}>{t('exp.format')}</div>
        <div role="radiogroup" aria-label={t('exp.format')} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {formatCard('xlsx', t('exp.fXlsx'), t('exp.fXlsxHint'))}
          {formatCard('csv', t('exp.fCsv'), t('exp.fCsvHint'))}
        </div>

        <FormMessage error={error} success={done} />
        <PrimaryButton>{t('exp.download')}</PrimaryButton>
        <div style={{ fontSize: 11, color: 'var(--color-ink-3)', marginTop: 10, textAlign: 'center' }}>{t('exp.private')}</div>
      </form>
    </div>
  );
}
