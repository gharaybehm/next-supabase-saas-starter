'use client';

import { useState } from 'react';
import SegmentedControl from '@/app/components/ui/SegmentedControl';
import { Input, Label } from '@/app/components/ui/fields';

interface TransactionTypeFieldProps {
  transactionTypeLabel: string;
  saleLabel: string;
  rentLabel: string;
  priceLabelSale: string;
  priceLabelRent: string;
  pricePlaceholder: string;
}

export default function TransactionTypeField({
  transactionTypeLabel,
  saleLabel,
  rentLabel,
  priceLabelSale,
  priceLabelRent,
  pricePlaceholder,
}: TransactionTypeFieldProps) {
  const [transactionType, setTransactionType] = useState<'sale' | 'rent'>('sale');

  return (
    <>
      <div>
        <Label>{transactionTypeLabel}</Label>
        <SegmentedControl
          options={[{ value: 'sale', label: saleLabel }, { value: 'rent', label: rentLabel }]}
          value={transactionType}
          onChange={(v) => setTransactionType(v as 'sale' | 'rent')}
        />
        <input type="hidden" name="transaction_type" value={transactionType} />
      </div>
      <div>
        <Label>{transactionType === 'sale' ? priceLabelSale : priceLabelRent}</Label>
        <Input name="price_aed" type="number" required min={1} placeholder={pricePlaceholder} />
      </div>
    </>
  );
}
