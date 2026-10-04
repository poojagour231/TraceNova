import re


def normalize_phone(phone):
    if phone is None:
        return None

    phone = str(phone).strip()

    # Remove common formatting characters
    phone = re.sub(r"[\s\-\(\)]", "", phone)

    # Remove Indian country code
    if phone.startswith("+91"):
        phone = phone[3:]

    elif phone.startswith("91") and len(phone) == 12:
        phone = phone[2:]

    return phone


def normalize_imei(imei):
    if imei is None:
        return None

    imei = str(imei).strip()

    # Keep only digits
    imei = re.sub(r"\D", "", imei)

    return imei


def normalize_imsi(imsi):
    if imsi is None:
        return None

    imsi = str(imsi).strip()

    # Keep only digits
    imsi = re.sub(r"\D", "", imsi)

    return imsi


def normalize_ip(ip_address):
    if ip_address is None:
        return None

    return str(ip_address).strip()


def normalize_upi(upi_id):
    if upi_id is None:
        return None

    upi_id = str(upi_id).strip().lower()

    return upi_id


def normalize_mac(mac_address):
    if mac_address is None:
        return None

    mac_address = str(mac_address).strip().lower()

    # Remove separators
    mac_address = re.sub(r"[:\-.]", "", mac_address)

    return mac_address


def normalize_email(email):
    if email is None:
        return None

    return str(email).strip().lower()