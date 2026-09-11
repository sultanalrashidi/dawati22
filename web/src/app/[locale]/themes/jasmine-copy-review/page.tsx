import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { CollectionReview } from '@/components/themes/collection-review';
import { jasmineBrideCopyDesign } from '@/lib/themes/builder/jasmine-bride-copy';

export default async function JasmineCopyReviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const qrDataUrl = await QRCode.toDataURL('jasmine-copy-preview-not-an-entry-pass', { margin: 1, width: 320 });
  return <CollectionReview designs={[jasmineBrideCopyDesign()]} qrDataUrl={qrDataUrl} title="عروس الياسمين (نسخة)" initialScene="cover" newDesign />;
}
