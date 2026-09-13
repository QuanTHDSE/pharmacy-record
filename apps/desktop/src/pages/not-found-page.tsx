import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="grid min-h-[65vh] place-items-center text-center">
      <div>
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
          <FileQuestion className="size-8" />
        </div>
        <p className="mt-5 text-sm font-bold text-emerald-700">404</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Không tìm thấy trang</h1>
        <p className="mt-2 text-sm text-slate-500">Đường dẫn này không tồn tại trong ứng dụng.</p>
        <Link
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white"
          to="/"
        >
          <ArrowLeft className="size-4" /> Quay về tổng quan
        </Link>
      </div>
    </div>
  );
}
