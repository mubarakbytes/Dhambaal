# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.


# My System Artitechture

## For Login
- We have a welcoming screen or section that contain 2 buttons 
    - one button for creation about new account
    - second button is for restoring/loging exist account


    ### for craetion button
        - When user click Create we neeed to ask A name and that name we can use for is just displaying 
        - then should have a button named continue or "sii wad" that button when user click we need,
          the system to generate keys public key and private key

        - Public Key
            we use as username that we use people to communciate when we are becaeming friend like we need it like to be the phone number.

        - Private Key
            this key is the special key you know and we use as like password but we dont want to keep or store it  because its sensive mesasges everything are encryption and this is the one that dencrypting back. so i am still planing how we could keep this secret and safer and am trying to implement and use the seed pharse. so yeah that is looks me perfect and also user always use his lock phone to enter the application.

    ### Storing data

        - Contacts are stored their name and public key and their id is the public key
        - Messages are encrypted before stored 
        - calls are stored using id i mean public key and the situation where missed call. answered call 
          etc and when display in the ui we using their name i alraedy done that no changes .
    we need to use GunDB for storing the data in both for android and mobile phone


    ### connection
    this is very important we need always direct connection p2p we use STUN which i think it has 80 success rate so some devices are behind sematric NAT  which is so restrict and that cause STUN Should fail to fix that we need to use the famous trick which is UDP hole punching. alwasy connection should be direct p2p. we need to use WebRTC but you can use perfect libararies that abstarct the complexity of using pure WebRTC yeah but keep in your mind that this application is mobile and web not only mobile and its single code base.


# About Me
as i am developer i always love to know every step that the agent does so there is issue if you do everything silent its hard to me to review back what you have dones i am soo lazay guy to scape that issue i request when you done small think i need to notice me and force me to review before the code became more complex and that cause me to be so sad and hate my self. so please if you do small think force me to reveiw and use clear names and comments so i can understand easily and note english is not my first language even its not my second language so use english that any one can undertand easily don't use variable names function named or other names so please avoid cryptic non-descriptive or obscure variable names please and please.

in service/ directory my aim is to write there the logic app there that directory service and prepare as function so we can call inside the ui files *.jsx 

# Note 
i started the project alearly and i finished the most of the design
        
