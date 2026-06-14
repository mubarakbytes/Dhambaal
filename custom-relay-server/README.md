# 🌐 Dhambaal Private Custom Relay (TURN Server)

*Read this in [English](#english-instructions) | Akhriso [Af-Soomaali](#tilmaamaha-af-soomaaliga)*

---

## 🇸🇴 Tilmaamaha Af-Soomaaliga

Ku soo dhawaaw xalka ugu dambeeya ee isku xirka daadejisan (decentralized)! Haddii aadan doonayn inaad ku kalsoonaato Server-yada Guud ee Relay (Default Relays) ee ku dhex jira app-ka Dhambaal, waxaad si fudud u abuuri kartaa server-kaaga gaarka ah adigoo isticmaalaya Docker-kan.

Faylkan wuxuu kuu sahlayaa inaad sameysato server **Coturn** ah oo aad u fudud kana xawli badan, kaas oo loogu talagalay inuu gudbiyo codadka iyo qoraallada WebRTC.

### 🚀 Sida loo rakibo 2 daqiiqo gudahood:

#### Tallaabada 1: Hel Cloud Server
Kiro server Linux ah oo yar (wuxuu ku kacayaa $5/bishii haddii aad isticmaasho DigitalOcean, AWS, ama Linode) kadibna ku shub Docker.

#### Tallaabada 2: Nuqul ka samee faylalkan
Ku shub faylasha kala ah `docker-compose.yml` iyo `turnserver.conf` server-kaaga cusub.

#### Tallaabada 3: Wax ka beddel IP Address-ka
Fur faylka `turnserver.conf` oo beddel ereyga `YOUR_SERVER_PUBLIC_IP` adigoo ku beddelaya IP-ga rasmiga ah ee server-kaaga.
*(Waxaad sidoo kale beddeli kartaa username-ka iyo password-ka ku jira faylkan).*

#### Tallaabada 4: Daar Server-ka!
Ku qor amarkan (command) terminal-ka server-kaaga:
```bash
docker-compose up -d
```

#### Tallaabada 5: Ku xir App-ka Dhambaal
Ka fur app-ka Dhambaal taleefankaaga, tag **Aniga > Habeyn > Xiriirka (Relay)** oo ku qor:
*   **Relay URL:** `turn:YOUR_SERVER_PUBLIC_IP:3478`
*   **Username:** `dhambaal_user` (ama magacii aad u bixisay)
*   **Password:** `dhambaal_secure_password_123`

Hambalyo! Hadda adiga ayaa si buuxda u maamulaya isku xirkaaga iyo xogtaada! 🎉

---

## 🇬🇧 English Instructions

Welcome to the ultimate decentralized solution! If you do not want to trust the default public Relay Servers provided in the Dhambaal app, you can easily spin up your own using this Docker configuration. 

This folder configures a lightweight, ultra-fast **Coturn** server designed perfectly for WebRTC audio and text relay.

### 🚀 How to deploy in 2 minutes:

#### Step 1: Get a Cloud Server
Rent a small Linux server ($5/month on DigitalOcean, AWS, or Linode) and install Docker.

#### Step 2: Copy these files
Upload `docker-compose.yml` and `turnserver.conf` to your new server.

#### Step 3: Edit the IP Address
Open `turnserver.conf` and change `YOUR_SERVER_PUBLIC_IP` to your server's actual public IP address.
*(You can also change the username and password in this file).*

#### Step 4: Run it!
Run the following command in the terminal of your server:
```bash
docker-compose up -d
```

#### Step 5: Connect your Dhambaal App
Open the Dhambaal app on your phone, go to **Aniga > Habeyn > Xiriirka (Relay)** and enter:
*   **Relay URL:** `turn:YOUR_SERVER_PUBLIC_IP:3478`
*   **Username:** `dhambaal_user` (or whatever you changed it to)
*   **Password:** `dhambaal_secure_password_123`

You are now officially hosting your own decentralized infrastructure! 🎉
