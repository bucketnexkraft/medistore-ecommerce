import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { PiArrowClockwise, PiChartBar } from 'react-icons/pi';
import { getDashboardReport } from '../../api/dashboard';
import { formatPrice } from '../../hooks/currency';
import TableLoading from '../../components/loadings/TableLoading';

export default function ProductSalesRankingReport({ direction = 'top' }) {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [period, setPeriod] = useState('monthly');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isTop = direction === 'top';
  const title = isTop
    ? 'Top Selling Product Report'
    : 'Lowest Selling Product Report';

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    const loadReport = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getDashboardReport(accessToken, { type: period });
        const key = isTop
          ? 'highestSellingProducts'
          : 'lowestSellingProducts';
        if (active) {
          setProducts(Array.isArray(response?.data?.[key]) ? response.data[key] : []);
        }
      } catch (requestError) {
        if (active) {
          setProducts([]);
          setError(
            requestError?.response?.data?.message ||
              requestError?.message ||
              'Could not load the report.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadReport();
    return () => {
      active = false;
    };
  }, [accessToken, isTop, period]);

  return (
    <div className='space-y-5 p-4 text-slate-900 sm:p-6'>
      <div className='flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-start gap-3'>
          <span className='grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600'>
            <PiChartBar size={22} />
          </span>
          <div>
            <p className='text-xs font-bold uppercase tracking-wider text-blue-600'>
              Reports & Insights
            </p>
            <h1 className='mt-1 text-2xl font-bold'>{title}</h1>
            <p className='mt-1 text-sm text-slate-500'>
              {isTop
                ? 'The five products with the highest quantity sold in this period.'
                : 'The five sold products with the lowest quantity sold in this period.'}
            </p>
          </div>
        </div>
        <label className='flex items-center gap-2 text-sm font-semibold text-slate-600'>
          Period
          <select
            className='select select-bordered select-sm bg-white'
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value='daily'>Today</option>
            <option value='monthly'>This month</option>
            <option value='yearly'>This year</option>
          </select>
        </label>
      </div>

      {loading ? (
        <TableLoading />
      ) : error ? (
        <div className='rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700'>
          {error}
        </div>
      ) : products.length === 0 ? (
        <div className='rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500'>
          No product sales found for this period.
        </div>
      ) : (
        <div className='overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'>
          <div className='flex items-center gap-2 border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-600'>
            <PiArrowClockwise size={17} />
            Based on sale invoice quantities for the selected period
          </div>
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[600px] text-left text-sm'>
              <thead className='bg-slate-50 text-xs uppercase tracking-wide text-slate-500'>
                <tr>
                  <th className='px-5 py-3'>Rank</th>
                  <th className='px-5 py-3'>Product</th>
                  <th className='px-5 py-3'>Code</th>
                  <th className='px-5 py-3 text-right'>Quantity sold</th>
                  <th className='px-5 py-3 text-right'>Sales amount</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100'>
                {products.map((product, index) => (
                  <tr key={product.product_id || index}>
                    <td className='px-5 py-4 font-semibold text-slate-500'>
                      {index + 1}
                    </td>
                    <td className='px-5 py-4 font-semibold text-slate-900'>
                      {product.name || 'N/A'}
                    </td>
                    <td className='px-5 py-4 text-slate-500'>
                      {product.code || 'N/A'}
                    </td>
                    <td className='px-5 py-4 text-right font-semibold'>
                      {Number(product.total_qty || 0).toLocaleString()}
                    </td>
                    <td className='px-5 py-4 text-right'>
                      {formatPrice(product.total_sales)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
