import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PageHeader, Screen, Surface } from '@/components/WarungUI';
import { useColors } from '@/hooks/useColors';

type Operator = '+' | '−' | '×' | '÷';
type CalculatorKey = string;

const keyRows: CalculatorKey[][] = [
  ['AC', '±', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '='],
];

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) return 'Error';
  const rounded = Number.parseFloat(value.toPrecision(10));
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 10, useGrouping: false });
};

export default function CalculatorScreen() {
  const c = useColors();
  const [display, setDisplay] = useState('0');
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [formula, setFormula] = useState('');

  const reset = () => {
    setDisplay('0');
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(false);
    setFormula('');
  };

  const inputDigit = (digit: string) => {
    if (display === 'Error' || waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
      return;
    }
    setDisplay(display === '0' ? digit : `${display}${digit}`);
  };

  const inputDecimal = () => {
    if (display === 'Error' || waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) setDisplay(`${display}.`);
  };

  const chooseOperator = (nextOperator: Operator) => {
    const inputValue = Number(display);
    if (!Number.isFinite(inputValue)) {
      reset();
      return;
    }

    if (storedValue !== null && operator && !waitingForOperand) {
      const result = calculate(storedValue, inputValue, operator);
      const formatted = formatNumber(result);
      setDisplay(formatted);
      setStoredValue(formatted === 'Error' ? null : Number(formatted));
      setFormula(`${formatted} ${nextOperator}`);
    } else {
      setStoredValue(inputValue);
      setFormula(`${display} ${nextOperator}`);
    }
    setOperator(nextOperator);
    setWaitingForOperand(true);
  };

  const calculateResult = () => {
    if (storedValue === null || !operator || waitingForOperand) return;
    const inputValue = Number(display);
    const result = calculate(storedValue, inputValue, operator);
    const formatted = formatNumber(result);
    setFormula(`${formatNumber(storedValue)} ${operator} ${display} =`);
    setDisplay(formatted);
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(true);
  };

  const handleKey = (key: CalculatorKey) => {
    if (/^\d$/.test(key)) {
      inputDigit(key);
    } else if (key === '.') {
      inputDecimal();
    } else if (key === 'AC') {
      reset();
    } else if (key === '±') {
      if (display !== '0' && display !== 'Error') setDisplay(formatNumber(Number(display) * -1));
    } else if (key === '%') {
      if (display !== 'Error') setDisplay(formatNumber(Number(display) / 100));
    } else if (key === '=') {
      calculateResult();
    } else {
      chooseOperator(key as Operator);
    }
  };

  return (
    <Screen>
      <PageHeader
        eyebrow="Alat bantu"
        title="Kalkulator"
        subtitle="Hitung cepat tanpa meninggalkan pencatatan warung."
      />

      <Surface style={s.calculator}>
        <View style={[s.displayPanel, { backgroundColor: c.foreground }]}>
          <Text style={[s.formula, { color: c.primaryForeground + 'B8' }]} numberOfLines={1}>{formula || 'Siap menghitung'}</Text>
          <Text style={[s.display, { color: c.card }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.45}>{display}</Text>
        </View>

        <View style={s.keyGrid}>
          {keyRows.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={s.keyRow}>
              {row.map((key) => (
                <CalculatorButton key={key} label={key} onPress={() => handleKey(key)} />
              ))}
            </View>
          ))}
        </View>
      </Surface>

      <View style={[s.tip, { backgroundColor: c.secondary }]}>
        <Ionicons name="bulb-outline" size={17} color={c.primary} />
        <Text style={[s.tipText, { color: c.mutedForeground }]}>Hasil perhitungan tidak mengubah catatan penjualan atau pengeluaran.</Text>
      </View>
    </Screen>
  );
}

function calculate(first: number, second: number, operator: Operator) {
  if (operator === '+') return first + second;
  if (operator === '−') return first - second;
  if (operator === '×') return first * second;
  return second === 0 ? Number.NaN : first / second;
}

function CalculatorButton({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  const isOperator = ['÷', '×', '−', '+'].includes(label);
  const isAction = ['AC', '±', '%'].includes(label);
  const isEquals = label === '=';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Tombol ${label}`}
      onPress={onPress}
      style={({ pressed }) => [
        s.key,
        label === '0' && s.zeroKey,
        {
          backgroundColor: isEquals ? c.accent : isOperator ? c.primary : isAction ? c.secondary : c.card,
          borderColor: isEquals ? c.accent : isOperator ? c.primary : c.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {label === '×' ? (
        <Text style={[s.keyText, { color: isOperator ? c.primaryForeground : c.foreground }]}>×</Text>
      ) : (
        <Text style={[s.keyText, { color: isEquals || isOperator ? c.primaryForeground : isAction ? c.primary : c.foreground }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  calculator: { padding: 12, borderRadius: 24 },
  displayPanel: { minHeight: 132, borderRadius: 18, padding: 18, justifyContent: 'flex-end', alignItems: 'flex-end' },
  formula: { width: '100%', textAlign: 'right', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  display: { width: '100%', textAlign: 'right', fontSize: 46, fontWeight: '700', letterSpacing: -1.5 },
  keyGrid: { gap: 9, marginTop: 12 },
  keyRow: { flexDirection: 'row', gap: 9 },
  key: { flex: 1, minHeight: 62, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  zeroKey: { flex: 2 },
  keyText: { fontSize: 22, fontWeight: '800' },
  tip: { marginTop: 13, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipText: { flex: 1, fontSize: 11, lineHeight: 16 },
});