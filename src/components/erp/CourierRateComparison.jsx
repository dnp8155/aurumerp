import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Truck, Loader2, IndianRupee, Check, Star, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function CourierRateComparison({ shipment, pickupPincode, deliveryPincode, onBooked }) {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(null);
  const [cod, setCod] = useState(false);
  const [declaredValue, setDeclaredValue] = useState(shipment?.total_value || 500);
  const [weight, setWeight] = useState(shipment?.weight || 0.5);
  const { toast } = useToast();

  const fetchRates = async () => {
    if (!pickupPincode || !deliveryPincode) {
      toast({ title: "Missing pincodes", description: "Source and destination store pincodes required", variant: "destructive" });
      return;
    }
    setLoading(true);
    setRates([]);
    try {
      const res = await base44.functions.invoke("shiprocket", {
        action: "rates",
        pickup_postcode: pickupPincode,
        delivery_postcode: deliveryPincode,
        weight,
        cod,
        declared_value: declaredValue,
      });
      const couriers = res?.data?.rates?.data?.available_courier_companies || [];
      if (couriers.length === 0) {
        toast({ title: "No couriers available", description: "No courier service for this route/pincode", variant: "destructive" });
      }
      setRates(couriers);
    } catch (err) {
      toast({ title: "Failed to fetch rates", description: err?.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const bookCourier = async (courier) => {
    setBooking(courier.courier_company_id);
    try {
      const orderData = {
        order_id: shipment?.shipment_number || `SHP-${Date.now()}`,
        order_date: new Date().toISOString().split("T")[0],
        pickup_location: "Primary",
        billing_customer_name: shipment?.from_store_name || "Sender",
        billing_last_name: "",
        billing_address: "Warehouse",
        billing_city: "City",
        billing_pincode: pickupPincode,
        billing_state: "State",
        billing_country: "India",
        billing_email: "noreply@aurumerp.com",
        billing_phone: "9999999999",
        shipping_customer_name: shipment?.to_store_name || "Receiver",
        shipping_last_name: "",
        shipping_address: "Warehouse",
        shipping_city: "City",
        shipping_pincode: deliveryPincode,
        shipping_state: "State",
        shipping_country: "India",
        shipping_email: "noreply@aurumerp.com",
        shipping_phone: "9999999999",
        order_items: [
          {
            name: "Shipment Items",
            sku: shipment?.pallet_code || "SHP",
            units: shipment?.total_quantity || 1,
            selling_price: declaredValue,
            discount: 0,
            tax: 0,
            hsn: 9988,
          },
        ],
        payment_method: cod ? "COD" : "Prepaid",
        sub_total: declaredValue,
        length: 10,
        breadth: 10,
        height: 10,
        weight: weight,
        courier_id: courier.courier_company_id,
      };

      const res = await base44.functions.invoke("shiprocket", { action: "book", order_data: orderData });
      const order = res?.data?.order || {};

      if (onBooked) {
        await onBooked({
          courier_name: courier.courier_name,
          courier_rate: courier.rate,
          awb_code: order.awb_code || order.shipment_id || "",
          shiprocket_order_id: order.order_id || order.shiprocket_order_id || "",
        });
      }

      toast({ title: "Shipment booked!", description: `${courier.courier_name} · AWB: ${order.awb_code || "pending"}` });
    } catch (err) {
      toast({ title: "Booking failed", description: err?.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setBooking(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Courier Rate Comparison</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Weight (kg)</Label>
          <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(parseFloat(e.target.value) || 0.5)} className="h-8" />
        </div>
        <div>
          <Label className="text-xs">Declared Value (₹)</Label>
          <Input type="number" value={declaredValue} onChange={(e) => setDeclaredValue(parseFloat(e.target.value) || 500)} className="h-8" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={cod} onChange={(e) => setCod(e.target.checked)} className="rounded" />
          COD
        </label>
        <Button size="sm" onClick={fetchRates} disabled={loading} className="ml-auto">
          {loading ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Fetching...</> : "Get Courier Rates"}
        </Button>
      </div>

      {rates.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {rates.map((c) => (
            <div key={c.courier_company_id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex-1">
                <p className="text-sm font-semibold">{c.courier_name}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><IndianRupee className="h-3 w-3" />{c.rate}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{c.estimated_delivery_days || "—"} days</span>
                  {c.rating > 0 && <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500" />{c.rating}</span>}
                  {cod && c.cod_charges > 0 && <span>COD: ₹{c.cod_charges}</span>}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bookCourier(c)}
                disabled={booking !== null}
              >
                {booking === c.courier_company_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                Book
              </Button>
            </div>
          ))}
        </div>
      )}

      {rates.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Click "Get Courier Rates" to compare Bluedart, Delhivery, DHL, Xpressbees, FedEx & more.
        </p>
      )}
    </div>
  );
}