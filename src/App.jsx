import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Stores from '@/pages/Stores';
import Vendors from '@/pages/Vendors';
import PurchaseOrders from '@/pages/PurchaseOrders';
import PurchaseOrderCreate from '@/pages/PurchaseOrderCreate';
import GoodsReceipt from '@/pages/GoodsReceipt';
import Cataloging from '@/pages/Cataloging';
import Inventory from '@/pages/Inventory';
import Allocations from '@/pages/Allocations';
import Pallets from '@/pages/Pallets';
import AuditTrail from '@/pages/AuditTrail';
import Settings from '@/pages/Settings';
import POS from '@/pages/POS';
import Returns from '@/pages/Returns';
import Rentals from '@/pages/Rentals';
import Repairs from '@/pages/Repairs';
import RepairDetail from '@/pages/RepairDetail';
import Ecommerce from '@/pages/Ecommerce';
import Finance from '@/pages/Finance';
import GST from '@/pages/GST';
import Assistant from '@/pages/Assistant';
import BarcodeEngine from '@/pages/BarcodeEngine';
import Help from '@/pages/Help';
import GoogleVision from '@/pages/GoogleVision';
import TallyExport from '@/pages/TallyExport';
import TallySync from '@/pages/TallySync';
import VendorPayouts from '@/pages/VendorPayouts';
import Money from '@/pages/Money';
import Sales from '@/pages/Sales';
import Stock from '@/pages/Stock';
import UserRoles from '@/pages/UserRoles';
import HR from '@/pages/HR';
import WarehouseDashboard from '@/pages/Warehouse';
import CustomReports from '@/pages/CustomReports';
import Alerts from '@/pages/Alerts';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
        <Route path="/stores" element={<Stores />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/purchase-orders" element={<PurchaseOrders />} />
        <Route path="/purchase-orders/new" element={<PurchaseOrderCreate />} />
        <Route path="/goods-receipt" element={<GoodsReceipt />} />
        <Route path="/cataloging" element={<Cataloging />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/allocations" element={<Allocations />} />
        <Route path="/pallets" element={<Pallets />} />
        <Route path="/audit-trail" element={<AuditTrail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/rentals" element={<Rentals />} />
        <Route path="/repairs" element={<Repairs />} />
        <Route path="/repairs/:id" element={<RepairDetail />} />
        <Route path="/ecommerce" element={<Ecommerce />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/gst" element={<GST />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/barcode-engine" element={<BarcodeEngine />} />
        <Route path="/help" element={<Help />} />
        <Route path="/user-roles" element={<UserRoles />} />
        <Route path="/hr" element={<HR />} />
        <Route path="/warehouse" element={<WarehouseDashboard />} />
        <Route path="/custom-reports" element={<CustomReports />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/google-vision" element={<GoogleVision />} />
        <Route path="/tally-export" element={<TallyExport />} />
        <Route path="/tally-sync" element={<TallySync />} />
        <Route path="/vendor-payouts" element={<VendorPayouts />} />
        <Route path="/money" element={<Money />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/stock" element={<Stock />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App