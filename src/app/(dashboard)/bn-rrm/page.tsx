import BNRRMClient from './BNRRMClient';

export const metadata = {
  title: 'BN-RRM Risk Assessment | SSTAC Dashboard',
  description: 'Bayesian Network Relative Risk Model for sediment quality assessment',
};

export default function BNRRMPage() {
  return <BNRRMClient />;
}
