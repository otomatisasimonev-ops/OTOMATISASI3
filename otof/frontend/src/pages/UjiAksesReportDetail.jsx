import { useParams } from 'react-router-dom';
import UjiAksesReportForm from './UjiAksesReportForm';

const UjiAksesReportDetail = () => {
  const { id } = useParams();
  return <UjiAksesReportForm reportId={id} />;
};

export default UjiAksesReportDetail;

