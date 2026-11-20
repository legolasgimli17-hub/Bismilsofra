-- v1 pilot: transaction-committed, PII-free change notifications for
-- authenticated restaurant and customer event streams. NOTIFY is not durable:
-- clients MUST reconcile with the existing HTTP snapshot after reconnect.
CREATE FUNCTION notify_order_event_v1() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE r uuid; c uuid;
BEGIN
 SELECT restaurant_id,customer_id INTO r,c FROM orders WHERE id=NEW.order_id;
 PERFORM pg_notify('bismil_order_events',
  json_build_object('restaurantId',r,'customerId',c)::text);
 RETURN NEW;
END;
$$;
CREATE TRIGGER order_event_signal AFTER INSERT ON order_events
 FOR EACH ROW EXECUTE FUNCTION notify_order_event_v1();
