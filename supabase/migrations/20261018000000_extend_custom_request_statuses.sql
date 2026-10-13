alter type public.custom_request_status add value if not exists 'pending';
alter type public.custom_request_status add value if not exists 'confirmed';
alter type public.custom_request_status add value if not exists 'processing';
alter type public.custom_request_status add value if not exists 'shipped';
alter type public.custom_request_status add value if not exists 'delivered';
alter type public.custom_request_status add value if not exists 'cancelled';
alter type public.custom_request_status add value if not exists 'refunded';
