# --------------------------------------------------------------------------------------------------------------
# to be used by demo developer
# --------------------------------------------------------------------------------------------------------------
APPLICATION_NAME := $(shell basename `pwd`)
$(info APPLICATION_NAME=$(APPLICATION_NAME))

ifdef ACCOUNT_SID
$(info Twilio ACCOUNT_SID=$(ACCOUNT_SID))
else
$(info Twilio ACCOUNT_SID environment variable is not set)
$(info Lookup your "ACCOUNT SID" at https://console.twilio.com/)
ACCOUNT_SID := $(shell read -p "Enter ACCOUNT_SID=" input && echo $$input)
$(info )
endif

ifdef AUTH_TOKEN
$(info Twilio AUTH_TOKEN=$(shell echo $(AUTH_TOKEN) | sed 's/./*/g'))
else
$(info Twilio Account SID environment variable is not set)
$(info Lookup your "AUTH TOKEN" at https://console.twilio.com/)
AUTH_TOKEN := $(shell read -p "Enter AUTH_TOKEN=" input && echo $$input)
$(info )
endif

targets:
	@grep '^[A-Za-z0-9\-]*:' Makefile | cut -d ':' -f 1 | sort


fetch-service-sid:
	$(eval SERVICE_SID := $(shell curl https://serverless.twilio.com/v1/Services \
		--silent --user $(ACCOUNT_SID):$(AUTH_TOKEN) \
		| jq --raw-output '.services[] | select(.unique_name | contains("'$(APPLICATION_NAME)'")) | .sid'))
	@if [[ -z '$(SERVICE_SID)' ]]; then \
		echo "Service named '$(APPLICATION_NAME)' is not deployed!"; \
		false; \
	fi
	@echo SERVICE_SID=$(SERVICE_SID)


confirm-delete:
	@read -p "Delete $(APPLICATION_NAME) functions service? [Y/N] " answer && [ $${answer:-N} = y ]


delete: fetch-service-sid confirm-delete
	@curl -X DELETE https://serverless.twilio.com/v1/Services/$(SERVICE_SID) \
	--silent --user $(ACCOUNT_SID):$(AUTH_TOKEN) | jq .

	rm -f .twiliodeployinfo
	@echo ---------- "Deleted $(APPLICATION_NAME) Functions Service"


configure:
	@echo ---------- "Configuring $(APPLICATION_NAME) solution blueprint"

	@v=$$(grep CUSTOMER_NAME .env | sed 's/CUSTOMER_NAME=//'); \
	if [[ $$v == '' ]]; then \
	  echo "Your organization name to appear in SMS text"; \
	  read -p "Enter CUSTOMER_NAME=" input; \
	  sed -i -e s/CUSTOMER_NAME=/CUSTOMER_NAME=$$input/ .env; \
	fi;

	@v=$$(grep TWILIO_PHONE_NUMBER .env | sed 's/TWILIO_PHONE_NUMBER=//'); \
	if [[ $$v == '' ]]; then \
	  echo "Find your Twilio phone number to use in https://console.twilio.com/"; \
	  read -p "Enter TWILIO_PHONE_NUMBER (E.164 format)=" input; \
	  sed -i -e s/TWILIO_PHONE_NUMBER=/TWILIO_PHONE_NUMBER=$$input/ .env; \
	fi;

	@v=$$(grep APPLICATION_PASSWORD .env | sed 's/APPLICATION_PASSWORD=//'); \
	if [[ $$v == '' ]]; then \
	  echo "Password to protect application access"; \
	  read -s -p "Enter APPLICATION_PASSWORD=" input; \
	  sed -i -e s/APPLICATION_PASSWORD=/APPLICATION_PASSWORD=$$input/ .env; \
	fi;

	@v=$$(grep ADMINISTRATOR_PHONE .env | sed 's/ADMINISTRATOR_PHONE=//'); \
	if [[ $$v == '' ]]; then \
	  echo "Phone number to receive MFA verfication SMS"; \
	  read -p "Enter ADMINISTRATOR_PHONE (E.164 format)=" input; \
	  sed -i -e s/ADMINISTRATOR_PHONE=/ADMINISTRATOR_PHONE=$$input/ .env; \
	fi;

	@grep CUSTOMER_NAME .env
	@grep TWILIO_PHONE_NUMBER .env
	@echo 'APPLICATION_PASSWORD=\c' && grep APPLICATION_PASSWORD .env | sed 's/APPLICATION_PASSWORD=//' | sed 's/./*/g'
	@grep ADMINISTRATOR_PHONE .env
	@echo
	@echo "Configuration is complete. Please deploy via executing 'make deploy'"


deploy-serverless:
	@echo twilio serverless:deploy
	@twilio serverless:deploy --username=$(ACCOUNT_SID) --password=$(AUTH_TOKEN)


make-editable: fetch-service-sid
	@curl -X POST "https://serverless.twilio.com/v1/Services/$(SERVICE_SID)" \
	--data-urlencode "UiEditable=True" \
	--silent --user $(ACCOUNT_SID):$(AUTH_TOKEN) | jq .


deploy: deploy-serverless make-editable
	@echo ---------- "Deployed $(APPLICATION_NAME) solution blueprint"
