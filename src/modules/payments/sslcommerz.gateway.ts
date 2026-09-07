import config from "../../config";

const gatewayBaseUrl = (): string =>
  config.sslcommerz.isLive
    ? "https://securepay.sslcommerz.com"
    : "https://sandbox.sslcommerz.com";

export type SslcommerzInitiateInput = {
  tranId: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
  productName: string;
};

export type SslcommerzSession = {
  status?: string;
  sessionkey?: string;
  GatewayPageURL?: string;
  failedreason?: string;
};

export type SslcommerzValidation = {
  status?: string;
  tran_id?: string;
  val_id?: string;
  amount?: string;
  currency?: string;
  store_amount?: string;
  error?: string;
  risk_level?: string;
  [key: string]: string | number | boolean | null | undefined;
};

export type GatewayResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const parseJson = async (
  response: Response,
): Promise<Record<string, unknown>> => {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    // fall through to the invalid response error
  }
  throw new Error(`Invalid gateway response: ${text.slice(0, 200)}`);
};

export const initiateSslcommerzSession = async (
  input: SslcommerzInitiateInput,
): Promise<GatewayResult<SslcommerzSession>> => {
  if (!config.sslcommerz.storeId || !config.sslcommerz.storePassword) {
    return { ok: false, error: "SSLCommerz is not configured" };
  }

  const form = new URLSearchParams();
  form.set("store_id", config.sslcommerz.storeId);
  form.set("store_passwd", config.sslcommerz.storePassword);
  form.set("total_amount", input.amount.toFixed(2));
  form.set("currency", input.currency);
  form.set("tran_id", input.tranId);
  form.set("product_category", "Rent");
  form.set("product_name", input.productName);
  form.set("cus_name", input.customerName);
  form.set("cus_email", input.customerEmail);
  form.set("cus_add1", "N/A");
  form.set("cus_city", "N/A");
  form.set("cus_state", "N/A");
  form.set("cus_postcode", "0000");
  form.set("cus_country", "Bangladesh");
  form.set("cus_phone", input.customerMobile);
  form.set("success_url", input.successUrl);
  form.set("fail_url", input.failUrl);
  form.set("cancel_url", input.cancelUrl);
  form.set("ipn_url", input.ipnUrl);
  form.set("shipping_method", "NO");

  try {
    const response = await fetch(`${gatewayBaseUrl()}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data = await parseJson(response);
    const status = String(data.status ?? "");
    if (status === "success" || String(data.GatewayPageURL ?? "").length > 0) {
      return { ok: true, data: data as unknown as SslcommerzSession };
    }
    return {
      ok: false,
      error: String(
        data.failedreason ?? data.error ?? `Gateway status: ${status}`,
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `SSLCommerz request failed: ${message}` };
  }
};

export const validateSslcommerzTransaction = async (
  valId: string,
): Promise<GatewayResult<SslcommerzValidation>> => {
  if (!config.sslcommerz.storeId || !config.sslcommerz.storePassword) {
    return { ok: false, error: "SSLCommerz is not configured" };
  }

  const params = new URLSearchParams({
    val_id: valId,
    store_id: config.sslcommerz.storeId,
    store_passwd: config.sslcommerz.storePassword,
    format: "json",
  });

  try {
    const response = await fetch(
      `${gatewayBaseUrl()}/validator/api/validationserverAPI.php?${params.toString()}`,
      { method: "GET" },
    );
    const data = await parseJson(response);
    return { ok: true, data: data as unknown as SslcommerzValidation };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `SSLCommerz validation failed: ${message}` };
  }
};
